import { randomUUID } from "node:crypto";
import JobMonitor from "../models/JobMonitor.js";
import JobRun from "../models/JobRun.js";
import ApiError from "../utils/ApiError.js";
import { JOB_STATUS, PLANS, ROLES } from "../config/constants.js";
import { getPlanDefinition } from "../config/plans.js";
import { logActivity } from "../utils/activityLogger.js";
import {
  ACTIVITY_CATEGORIES,
  ACTIVITY_ACTIONS,
} from "../config/activityConstants.js";
import { escapeRegExp } from "../utils/regex.js";
import {
  generateJobToken,
  calculateNextRun,
  calculateNextEvaluation,
  recalculateScheduleForUpdate,
} from "./jobSchedule.service.js";

const getOwnerId = (user) => user?.id || user?._id;

/**
 * Creates a new JobMonitor with plan validation and initial token generation.
 * The plaintext token is returned only once in this creation payload.
 */
export const createJobMonitor = async (payload, user) => {
  if (user.role === ROLES.ADMIN) {
    throw ApiError.forbidden(
      "Administrators cannot create personal job monitors.",
      "ROLE_FORBIDDEN",
    );
  }

  const ownerId = getOwnerId(user);
  const plan = user.plan || PLANS.FREE;
  const definition = getPlanDefinition(plan);

  // Check quota limit
  const maxJobMonitors = definition?.limits?.maxJobMonitors;
  if (maxJobMonitors !== null && maxJobMonitors !== undefined) {
    const currentCount = await JobMonitor.countDocuments({ owner: ownerId });
    if (currentCount >= maxJobMonitors) {
      throw ApiError.upgradeRequired(
        `Your ${definition?.name || plan} plan allows up to ${maxJobMonitors} job monitors. Upgrade to add more.`,
        plan === PLANS.FREE ? PLANS.PRO : PLANS.UNLIMITED,
      );
    }
  }

  // Check minimum interval limit
  const minAllowedInterval = definition?.limits?.minJobIntervalSeconds || 10;
  if (
    payload.scheduleType === "interval" &&
    payload.intervalSeconds &&
    payload.intervalSeconds < minAllowedInterval
  ) {
    throw ApiError.upgradeRequired(
      `Your plan requires a minimum interval of ${minAllowedInterval} seconds. Upgrade for faster intervals.`,
    );
  }

  // Generate secure token
  const { token, prefix, tokenHash } = generateJobToken();

  // Compute initial schedules
  const now = new Date();
  const nextExpectedAt = calculateNextRun(payload, now);
  const nextEvaluationAt = calculateNextEvaluation(
    { ...payload, nextExpectedAt },
    now,
  );

  const jobMonitor = await JobMonitor.create({
    ...payload,
    owner: ownerId,
    tokenPrefix: prefix,
    tokenHash,
    status: JOB_STATUS.PENDING,
    active: payload.active !== undefined ? payload.active : true,
    nextExpectedAt,
    nextEvaluationAt,
  });

  await logActivity({
    userId: ownerId,
    category: ACTIVITY_CATEGORIES.MONITOR,
    action: ACTIVITY_ACTIONS.JOB_MONITOR_CREATED,
    description: `Created job monitor: ${jobMonitor.name}`,
    entityType: "JobMonitor",
    entityId: jobMonitor._id,
    metadata: {
      name: jobMonitor.name,
      scheduleType: jobMonitor.scheduleType,
      scheduleDisplay: jobMonitor.scheduleDisplay,
    },
  });

  const responseData = jobMonitor.toJSON();
  return {
    ...responseData,
    token, // Return plaintext token once
  };
};

/**
 * Retrieves paginated job monitors for the authenticated owner.
 */
export const getJobMonitors = async (query = {}, user) => {
  const ownerId = getOwnerId(user);
  const {
    page = 1,
    limit = 20,
    search,
    status = "all",
    active,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = query;

  const filter = { owner: ownerId };

  if (status && status !== "all") {
    filter.status = status;
  }

  if (typeof active === "boolean") {
    filter.active = active;
  }

  if (search) {
    const pattern = new RegExp(escapeRegExp(search), "i");
    filter.$or = [{ name: pattern }, { description: pattern }];
  }

  const sort = { [sortBy]: sortOrder === "asc" ? 1 : -1 };
  if (sortBy !== "_id") sort._id = -1;

  const skip = (page - 1) * limit;

  const [jobMonitors, total] = await Promise.all([
    JobMonitor.find(filter).sort(sort).skip(skip).limit(limit),
    JobMonitor.countDocuments(filter),
  ]);

  return {
    jobMonitors,
    total,
    page,
    limit,
  };
};

/**
 * Retrieves a single JobMonitor by ID, verifying tenant isolation.
 */
export const getJobMonitorById = async (id, user) => {
  const filter = { _id: id };
  if (user.role !== ROLES.ADMIN) {
    filter.owner = getOwnerId(user);
  }

  const jobMonitor = await JobMonitor.findOne(filter);
  if (!jobMonitor) {
    throw ApiError.notFound("Job monitor not found");
  }

  return jobMonitor;
};

/**
 * Updates a JobMonitor and recalculates future schedule milestones.
 */
export const updateJobMonitor = async (id, payload, user) => {
  const filter = { _id: id };
  if (user.role !== ROLES.ADMIN) {
    filter.owner = getOwnerId(user);
  }

  const jobMonitor = await JobMonitor.findOne(filter);
  if (!jobMonitor) {
    throw ApiError.notFound("Job monitor not found");
  }

  const plan = user.plan || PLANS.FREE;
  const definition = getPlanDefinition(plan);
  const minAllowedInterval = definition?.limits?.minJobIntervalSeconds || 10;

  if (
    payload.scheduleType === "interval" &&
    payload.intervalSeconds &&
    payload.intervalSeconds < minAllowedInterval
  ) {
    throw ApiError.upgradeRequired(
      `Your plan requires a minimum interval of ${minAllowedInterval} seconds. Upgrade for faster intervals.`,
    );
  }

  // Handle schedule recalculation if schedule parameters changed
  const isScheduleChanged =
    payload.scheduleType !== undefined ||
    payload.intervalSeconds !== undefined ||
    payload.cronExpression !== undefined ||
    payload.timezone !== undefined ||
    payload.gracePeriodSeconds !== undefined ||
    payload.runTimeoutSeconds !== undefined;

  let scheduleUpdates = {};
  if (isScheduleChanged) {
    scheduleUpdates = recalculateScheduleForUpdate(
      jobMonitor,
      payload,
      new Date(),
    );
  }

  Object.assign(jobMonitor, payload, scheduleUpdates);
  await jobMonitor.save();

  await logActivity({
    userId: getOwnerId(user),
    category: ACTIVITY_CATEGORIES.MONITOR,
    action: ACTIVITY_ACTIONS.JOB_MONITOR_UPDATED,
    description: `Updated job monitor: ${jobMonitor.name}`,
    entityType: "JobMonitor",
    entityId: jobMonitor._id,
    metadata: {
      name: jobMonitor.name,
      scheduleDisplay: jobMonitor.scheduleDisplay,
    },
  });

  return jobMonitor;
};

/**
 * Deletes a JobMonitor and all of its associated execution runs.
 */
export const deleteJobMonitor = async (id, user) => {
  const filter = { _id: id };
  if (user.role !== ROLES.ADMIN) {
    filter.owner = getOwnerId(user);
  }

  const jobMonitor = await JobMonitor.findOne(filter);
  if (!jobMonitor) {
    throw ApiError.notFound("Job monitor not found");
  }

  await Promise.all([
    JobRun.deleteMany({ jobMonitor: id }),
    jobMonitor.deleteOne(),
  ]);

  await logActivity({
    userId: getOwnerId(user),
    category: ACTIVITY_CATEGORIES.MONITOR,
    action: ACTIVITY_ACTIONS.JOB_MONITOR_DELETED,
    description: `Deleted job monitor: ${jobMonitor.name}`,
    entityType: "JobMonitor",
    entityId: id,
    metadata: { name: jobMonitor.name },
  });

  return {
    message: "Job monitor and all execution history deleted successfully",
  };
};

/**
 * Rotates reporting token securely. Preserves previousTokenHash to prevent immediate dropouts.
 * The new plaintext token is returned only in this response.
 */
export const rotateJobMonitorToken = async (id, user) => {
  const filter = { _id: id };
  if (user.role !== ROLES.ADMIN) {
    filter.owner = getOwnerId(user);
  }

  const jobMonitor = await JobMonitor.findOne(filter).select("+tokenHash");
  if (!jobMonitor) {
    throw ApiError.notFound("Job monitor not found");
  }

  const { token, prefix, tokenHash } = generateJobToken();

  jobMonitor.previousTokenHash = jobMonitor.tokenHash;
  jobMonitor.tokenPrefix = prefix;
  jobMonitor.tokenHash = tokenHash;
  jobMonitor.tokenRotatedAt = new Date();

  await jobMonitor.save();

  await logActivity({
    userId: getOwnerId(user),
    category: ACTIVITY_CATEGORIES.MONITOR,
    action: ACTIVITY_ACTIONS.JOB_MONITOR_TOKEN_ROTATED,
    description: `Rotated reporting token for job monitor: ${jobMonitor.name}`,
    entityType: "JobMonitor",
    entityId: jobMonitor._id,
    metadata: { tokenPrefix: prefix },
  });

  return {
    token, // Returned once upon rotation
    tokenPrefix: prefix,
    tokenRotatedAt: jobMonitor.tokenRotatedAt,
    message:
      "Reporting token rotated successfully. Update your background job scripts.",
  };
};

/**
 * Pauses or resumes a JobMonitor.
 */
export const toggleJobMonitorPause = async (id, pause = true, user) => {
  const filter = { _id: id };
  if (user.role !== ROLES.ADMIN) {
    filter.owner = getOwnerId(user);
  }

  const jobMonitor = await JobMonitor.findOne(filter);
  if (!jobMonitor) {
    throw ApiError.notFound("Job monitor not found");
  }

  const now = new Date();
  if (pause) {
    jobMonitor.active = false;
    jobMonitor.status = JOB_STATUS.PAUSED;
    jobMonitor.currentRunId = null;
    jobMonitor.currentRunStartedAt = null;
  } else {
    jobMonitor.active = true;
    jobMonitor.status = JOB_STATUS.PENDING;
    jobMonitor.nextExpectedAt = calculateNextRun(jobMonitor, now);
    jobMonitor.nextEvaluationAt = calculateNextEvaluation(
      { ...jobMonitor.toObject(), nextExpectedAt: jobMonitor.nextExpectedAt },
      now,
    );
  }

  await jobMonitor.save();

  await logActivity({
    userId: getOwnerId(user),
    category: ACTIVITY_CATEGORIES.MONITOR,
    action: pause
      ? ACTIVITY_ACTIONS.JOB_MONITOR_PAUSED
      : ACTIVITY_ACTIONS.JOB_MONITOR_RESUMED,
    description: `${pause ? "Paused" : "Resumed"} job monitor: ${jobMonitor.name}`,
    entityType: "JobMonitor",
    entityId: jobMonitor._id,
    metadata: { active: jobMonitor.active, status: jobMonitor.status },
  });

  return jobMonitor;
};

/**
 * Retrieves paginated run history for a JobMonitor.
 */
export const getJobRuns = async (jobMonitorId, query = {}, user) => {
  const filter = { _id: jobMonitorId };
  if (user.role !== ROLES.ADMIN) {
    filter.owner = getOwnerId(user);
  }

  const jobMonitor = await JobMonitor.findOne(filter);
  if (!jobMonitor) {
    throw ApiError.notFound("Job monitor not found");
  }

  const { page = 1, limit = 20, status = "all", sortOrder = "desc" } = query;
  const runFilter = { jobMonitor: jobMonitorId };
  if (status && status !== "all") {
    runFilter.status = status;
  }

  const skip = (page - 1) * limit;
  const sort = { createdAt: sortOrder === "asc" ? 1 : -1, _id: -1 };

  const [runs, total] = await Promise.all([
    JobRun.find(runFilter).sort(sort).skip(skip).limit(limit),
    JobRun.countDocuments(runFilter),
  ]);

  return {
    runs,
    total,
    page,
    limit,
  };
};
