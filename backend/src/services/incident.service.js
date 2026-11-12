import mongoose from "mongoose";
import Incident from "../models/Incident.js";
import Monitor from "../models/Monitor.js";
import JobMonitor from "../models/JobMonitor.js";
import ApiError from "../utils/ApiError.js";
import {
  WINDOW_MS,
  INCIDENT_STATUS,
  INCIDENT_STATUS_FILTER_ACTIVE,
  INCIDENT_STATUS_FILTER_ALL,
  INCIDENT_SEVERITY,
  MONITOR_POPULATE_FIELDS,
  TRIGGER_CHECK_POPULATE_FIELDS,
  TRIGGER_CHECK_DETAIL_POPULATE_FIELDS,
} from "../config/constants.js";
import { msBefore } from "../utils/dateUtils.js";
import { escapeRegExp } from "../utils/regex.js";
import { getOwnedMonitorIds } from "./monitor.service.js";
import { logActivity } from "../utils/activityLogger.js";
import {
  ACTIVITY_CATEGORIES,
  ACTIVITY_ACTIONS,
} from "../config/activityConstants.js";
import { syncIncidentById } from "./statusIncidentSync.service.js";
import { createNotification } from "./notification.service.js";
import { findDeploymentsNearIncident } from "./deployment.service.js";

// ── State machine ─────────────────────────────────────────────────────────────

/** Valid forward-only status transitions. */
const ALLOWED_TRANSITIONS = {
  [INCIDENT_STATUS.ONGOING]: [
    INCIDENT_STATUS.INVESTIGATING,
    INCIDENT_STATUS.IDENTIFIED,
    INCIDENT_STATUS.RESOLVED,
  ],
  [INCIDENT_STATUS.INVESTIGATING]: [
    INCIDENT_STATUS.IDENTIFIED,
    INCIDENT_STATUS.RESOLVED,
  ],
  [INCIDENT_STATUS.IDENTIFIED]: [INCIDENT_STATUS.RESOLVED],
  [INCIDENT_STATUS.RESOLVED]: [], // terminal
};

const resolveMonitorFilter = (ownedIds, monitorId) => {
  if (!monitorId) return { $in: ownedIds };
  const requested = new mongoose.Types.ObjectId(monitorId);
  return ownedIds.some((id) => id.equals(requested)) ? requested : { $in: [] };
};

const JOB_MONITOR_POPULATE_FIELDS =
  "name description scheduleType intervalSeconds cronExpression timezone status";

const restoreCheckSnapshots = (incident) => {
  if (!incident) return null;
  return {
    ...incident,
    triggerCheck:
      incident.triggerCheck || incident.triggerCheckSnapshot || null,
    recoveryCheck:
      incident.recoveryCheck || incident.recoveryCheckSnapshot || null,
    triggerJobRun:
      incident.triggerJobRun || incident.triggerJobRunSnapshot || null,
    recoveryJobRun:
      incident.recoveryJobRun || incident.recoveryJobRunSnapshot || null,
  };
};

// ── List incidents ────────────────────────────────────────────────────────────

export const getIncidents = async (
  {
    page,
    limit,
    severity,
    status,
    monitorId,
    jobMonitorId,
    resourceType,
    search,
    window,
    startDate,
    endDate,
    order,
  },
  user,
) => {
  const [ownedMonitorIds, ownedJobMonitorIds] = await Promise.all([
    getOwnedMonitorIds(user),
    JobMonitor.find({ owner: user._id || user.id }).distinct("_id"),
  ]);

  let resourceFilter;
  if (jobMonitorId) {
    const requested = new mongoose.Types.ObjectId(jobMonitorId);
    resourceFilter = ownedJobMonitorIds.some((id) => id.equals(requested))
      ? { jobMonitor: requested }
      : { jobMonitor: { $in: [] } };
  } else if (monitorId) {
    const requested = new mongoose.Types.ObjectId(monitorId);
    resourceFilter = ownedMonitorIds.some((id) => id.equals(requested))
      ? { monitor: requested }
      : { monitor: { $in: [] } };
  } else if (resourceType === "job_monitor") {
    resourceFilter = { jobMonitor: { $in: ownedJobMonitorIds } };
  } else if (resourceType === "monitor") {
    resourceFilter = { monitor: { $in: ownedMonitorIds } };
  } else {
    // Both monitors and job monitors owned by the user
    resourceFilter = {
      $or: [
        { monitor: { $in: ownedMonitorIds } },
        { jobMonitor: { $in: ownedJobMonitorIds } },
      ],
    };
  }

  const filter = {};

  if (status === INCIDENT_STATUS_FILTER_ACTIVE) {
    filter.status = { $ne: INCIDENT_STATUS.RESOLVED };
  } else if (status && status !== INCIDENT_STATUS_FILTER_ALL) {
    filter.status = status;
  }
  // status === INCIDENT_STATUS_FILTER_ALL → no status constraint at all.

  if (severity) {
    filter.severity = severity;
  }

  if (startDate && endDate) {
    filter.startedAt = { $gte: startDate, $lte: endDate };
  } else if (window) {
    filter.startedAt = { $gte: msBefore(WINDOW_MS[window]) };
  }

  if (search) {
    const pattern = new RegExp(escapeRegExp(search), "i");
    const [matchingMonitorIds, matchingJobMonitorIds] = await Promise.all([
      Monitor.find({
        _id: { $in: ownedMonitorIds },
        $or: [{ name: pattern }, { url: pattern }],
      }).distinct("_id"),
      JobMonitor.find({
        _id: { $in: ownedJobMonitorIds },
        $or: [{ name: pattern }, { description: pattern }],
      }).distinct("_id"),
    ]);

    filter.$and = [
      resourceFilter,
      {
        $or: [
          { monitor: { $in: matchingMonitorIds } },
          { jobMonitor: { $in: matchingJobMonitorIds } },
          { rootCause: pattern },
          { resolutionNotes: pattern },
        ],
      },
    ];
  } else {
    Object.assign(filter, resourceFilter);
  }

  const sortDirection = order === "asc" ? 1 : -1;
  const skip = (page - 1) * limit;

  const [incidents, total] = await Promise.all([
    Incident.find(filter)
      .populate("monitor", MONITOR_POPULATE_FIELDS)
      .populate("jobMonitor", JOB_MONITOR_POPULATE_FIELDS)
      .populate("triggerCheck", TRIGGER_CHECK_POPULATE_FIELDS)
      .populate("recoveryCheck", TRIGGER_CHECK_POPULATE_FIELDS)
      .populate(
        "triggerJobRun",
        "runId status scheduledFor startedAt completedAt durationMs exitCode errorMessage",
      )
      .populate(
        "recoveryJobRun",
        "runId status scheduledFor startedAt completedAt durationMs exitCode errorMessage",
      )
      .sort({ startedAt: sortDirection })
      .skip(skip)
      .limit(limit)
      .lean(),
    Incident.countDocuments(filter),
  ]);

  return {
    incidents: incidents.map(restoreCheckSnapshots),
    total,
    page,
    totalPages: Math.ceil(total / limit) || 1,
  };
};

// ── Single incident ───────────────────────────────────────────────────────────

export const getIncidentById = async (id, user) => {
  const [ownedMonitorIds, ownedJobMonitorIds] = await Promise.all([
    getOwnedMonitorIds(user),
    JobMonitor.find({ owner: user._id || user.id }).distinct("_id"),
  ]);

  const incident = await Incident.findOne({
    _id: id,
    $or: [
      { monitor: { $in: ownedMonitorIds } },
      { jobMonitor: { $in: ownedJobMonitorIds } },
    ],
  })
    .populate("monitor", MONITOR_POPULATE_FIELDS)
    .populate("jobMonitor", JOB_MONITOR_POPULATE_FIELDS)
    .populate("triggerCheck", TRIGGER_CHECK_DETAIL_POPULATE_FIELDS)
    .populate("recoveryCheck", TRIGGER_CHECK_DETAIL_POPULATE_FIELDS)
    .populate("triggerJobRun")
    .populate("recoveryJobRun")
    .lean();

  if (!incident) {
    throw ApiError.notFound(`Incident not found with id: ${id}`);
  }

  const restored = restoreCheckSnapshots(incident);
  try {
    restored.relatedDeployments = await findDeploymentsNearIncident(
      restored,
      user,
    );
  } catch {
    restored.relatedDeployments = [];
  }
  return restored;
};

// ── Update status ─────────────────────────────────────────────────────────────

export const updateIncidentStatus = async (
  id,
  { status, rootCause, resolutionNotes },
  user,
  { admin = false } = {},
) => {
  const [ownedMonitorIds, ownedJobMonitorIds] = admin
    ? [null, null]
    : await Promise.all([
        getOwnedMonitorIds(user),
        JobMonitor.find({ owner: user._id || user.id }).distinct("_id"),
      ]);

  const incident = await Incident.findOne({
    _id: id,
    ...(admin
      ? {}
      : {
          $or: [
            { monitor: { $in: ownedMonitorIds } },
            { jobMonitor: { $in: ownedJobMonitorIds } },
          ],
        }),
  })
    .populate("monitor", admin ? "name url owner" : MONITOR_POPULATE_FIELDS)
    .populate("jobMonitor", admin ? "name owner" : JOB_MONITOR_POPULATE_FIELDS);

  if (!incident) {
    throw ApiError.notFound(`Incident not found with id: ${id}`);
  }

  const previousStatus = incident.status;

  const allowed = ALLOWED_TRANSITIONS[previousStatus] || [];
  if (!allowed.includes(status)) {
    throw ApiError.badRequest(
      `Invalid status transition from "${previousStatus}" to "${status}"`,
    );
  }

  const ownerId = user.id || user._id.toString();
  const resourceName =
    incident.monitor?.name ||
    incident.jobMonitor?.name ||
    "a monitored resource";

  const logStatusChange = () =>
    logActivity({
      userId: ownerId,
      category: admin
        ? ACTIVITY_CATEGORIES.ADMIN
        : ACTIVITY_CATEGORIES.INCIDENT,
      action: admin
        ? ACTIVITY_ACTIONS.ADMIN_INCIDENT_RESOLVED
        : ACTIVITY_ACTIONS.INCIDENT_STATUS_UPDATED,
      description: `${admin ? "Administrator resolved" : "Marked"} incident on "${resourceName}" as ${status}`,
      entityType: "Incident",
      entityId: incident._id,
      metadata: {
        from: previousStatus,
        to: status,
        ...(admin
          ? {
              targetOwner: String(
                incident.monitor?.owner || incident.jobMonitor?.owner || "",
              ),
              reason: resolutionNotes || null,
              rootCause: rootCause || null,
            }
          : {}),
      },
    });

  const changedAt = new Date();
  const set = { status };
  if (rootCause != null) set.rootCause = rootCause;
  if (resolutionNotes != null) set.resolutionNotes = resolutionNotes;
  if (status === INCIDENT_STATUS.RESOLVED) {
    set.endedAt = changedAt;
    set.duration = Math.max(
      0,
      Math.round((changedAt - incident.startedAt) / 1000),
    );
  }
  const updatedIncident = await Incident.findOneAndUpdate(
    { _id: id, status: previousStatus },
    { $set: set, $push: { statusHistory: { status, changedAt } } },
    { returnDocument: "after" },
  );
  if (!updatedIncident) {
    throw ApiError.conflict(
      "This incident changed while you were updating it. Refresh and try again.",
    );
  }
  await logStatusChange();

  // Only sync to status-page if this incident belongs to an HTTP/API monitor
  if (incident.monitor) {
    await syncIncidentById(
      updatedIncident._id,
      status === INCIDENT_STATUS.RESOLVED ? "resolved" : "updated",
    );
  }

  await createNotification({
    ownerId: incident.monitor?.owner || incident.jobMonitor?.owner || ownerId,
    type:
      status === INCIDENT_STATUS.RESOLVED
        ? "incident_resolved"
        : "incident_updated",
    title:
      status === INCIDENT_STATUS.RESOLVED
        ? `Incident resolved: ${resourceName}`
        : `Incident update: ${resourceName}`,
    message:
      status === INCIDENT_STATUS.RESOLVED
        ? `The incident for ${resourceName} was marked resolved.`
        : `Incident status changed to ${status}.`,
    priority: incident.severity === "critical" ? "critical" : "high",
    link: incident.jobMonitor
      ? `/jobs/${incident.jobMonitor._id || incident.jobMonitor}`
      : "/incidents",
    relatedResource: { resourceType: "Incident", resourceId: incident._id },
  });

  const result = await Incident.findById(updatedIncident._id)
    .populate("monitor", MONITOR_POPULATE_FIELDS)
    .populate("jobMonitor", JOB_MONITOR_POPULATE_FIELDS)
    .populate("triggerCheck", TRIGGER_CHECK_POPULATE_FIELDS)
    .populate("recoveryCheck", TRIGGER_CHECK_POPULATE_FIELDS)
    .populate("triggerJobRun")
    .populate("recoveryJobRun")
    .lean();
  return restoreCheckSnapshots(result);
};

// ── Downtime statistics ───────────────────────────────────────────────────────

export const getDowntimeStats = async (
  { monitorId, jobMonitorId, resourceType, window },
  user,
) => {
  const [ownedMonitorIds, ownedJobMonitorIds] = await Promise.all([
    getOwnedMonitorIds(user),
    JobMonitor.find({ owner: user._id || user.id }).distinct("_id"),
  ]);
  const since = msBefore(WINDOW_MS[window]);

  let resourceFilter;
  if (jobMonitorId) {
    const requested = new mongoose.Types.ObjectId(jobMonitorId);
    resourceFilter = ownedJobMonitorIds.some((id) => id.equals(requested))
      ? { jobMonitor: requested }
      : { jobMonitor: { $in: [] } };
  } else if (monitorId) {
    const requested = new mongoose.Types.ObjectId(monitorId);
    resourceFilter = ownedMonitorIds.some((id) => id.equals(requested))
      ? { monitor: requested }
      : { monitor: { $in: [] } };
  } else if (resourceType === "job_monitor") {
    resourceFilter = { jobMonitor: { $in: ownedJobMonitorIds } };
  } else if (resourceType === "monitor") {
    resourceFilter = { monitor: { $in: ownedMonitorIds } };
  } else {
    resourceFilter = {
      $or: [
        { monitor: { $in: ownedMonitorIds } },
        { jobMonitor: { $in: ownedJobMonitorIds } },
      ],
    };
  }

  const matchFilter = {
    startedAt: { $gte: since },
    ...resourceFilter,
  };

  const [aggResults, topAffectedMonitors] = await Promise.all([
    Incident.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: null,
          totalIncidents: { $sum: 1 },
          resolvedCount: {
            $sum: {
              $cond: [{ $eq: ["$status", INCIDENT_STATUS.RESOLVED] }, 1, 0],
            },
          },
          ongoingCount: {
            $sum: {
              $cond: [{ $ne: ["$status", INCIDENT_STATUS.RESOLVED] }, 1, 0],
            },
          },
          // Per-status breakdown of the "still open" bucket above — used
          // by the Incident History page's downtime summary.
          ongoingOnlyCount: {
            $sum: {
              $cond: [{ $eq: ["$status", INCIDENT_STATUS.ONGOING] }, 1, 0],
            },
          },
          investigatingCount: {
            $sum: {
              $cond: [
                { $eq: ["$status", INCIDENT_STATUS.INVESTIGATING] },
                1,
                0,
              ],
            },
          },
          identifiedCount: {
            $sum: {
              $cond: [{ $eq: ["$status", INCIDENT_STATUS.IDENTIFIED] }, 1, 0],
            },
          },
          resolvedDowntime: {
            $sum: { $ifNull: ["$duration", 0] },
          },
          avgDuration: {
            $avg: {
              $cond: [{ $ne: ["$duration", null] }, "$duration", null],
            },
          },
          maxDuration: { $max: "$duration" },
          criticalCount: {
            $sum: {
              $cond: [{ $eq: ["$severity", INCIDENT_SEVERITY.CRITICAL] }, 1, 0],
            },
          },
          majorCount: {
            $sum: {
              $cond: [{ $eq: ["$severity", INCIDENT_SEVERITY.MAJOR] }, 1, 0],
            },
          },
          minorCount: {
            $sum: {
              $cond: [{ $eq: ["$severity", INCIDENT_SEVERITY.MINOR] }, 1, 0],
            },
          },
        },
      },
    ]),

    // Top 5 resources by incident count in the window
    Incident.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: { $ifNull: ["$monitor", "$jobMonitor"] },
          incidentCount: { $sum: 1 },
          totalDowntime: { $sum: { $ifNull: ["$duration", 0] } },
          criticalCount: {
            $sum: {
              $cond: [{ $eq: ["$severity", INCIDENT_SEVERITY.CRITICAL] }, 1, 0],
            },
          },
        },
      },
      { $sort: { incidentCount: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "monitors",
          localField: "_id",
          foreignField: "_id",
          as: "monitorInfo",
          pipeline: [{ $project: { name: 1, url: 1 } }],
        },
      },
      {
        $lookup: {
          from: "jobmonitors",
          localField: "_id",
          foreignField: "_id",
          as: "jobMonitorInfo",
          pipeline: [{ $project: { name: 1 } }],
        },
      },
      {
        $project: {
          _id: 0,
          monitorId: "$_id",
          resourceId: "$_id",
          name: {
            $ifNull: [
              { $arrayElemAt: ["$monitorInfo.name", 0] },
              { $arrayElemAt: ["$jobMonitorInfo.name", 0] },
            ],
          },
          url: { $arrayElemAt: ["$monitorInfo.url", 0] },
          resourceType: {
            $cond: [
              { $gt: [{ $size: "$jobMonitorInfo" }, 0] },
              "job_monitor",
              "monitor",
            ],
          },
          incidentCount: 1,
          totalDowntime: 1,
          criticalCount: 1,
        },
      },
    ]),
  ]);

  const aggResult = aggResults[0];

  const stats = aggResult || {
    totalIncidents: 0,
    resolvedCount: 0,
    ongoingCount: 0,
    ongoingOnlyCount: 0,
    investigatingCount: 0,
    identifiedCount: 0,
    resolvedDowntime: 0,
    avgDuration: null,
    maxDuration: null,
    criticalCount: 0,
    majorCount: 0,
    minorCount: 0,
  };

  // Add live downtime for ongoing incidents
  let liveDowntime = 0;
  if (stats.ongoingCount > 0) {
    const activeIncidents = await Incident.find({
      ...matchFilter,
      status: { $ne: INCIDENT_STATUS.RESOLVED },
    })
      .select("startedAt")
      .lean();

    const now = Date.now();
    liveDowntime = activeIncidents.reduce(
      (sum, inc) => sum + (now - new Date(inc.startedAt).getTime()) / 1000,
      0,
    );
  }

  return {
    totalIncidents: stats.totalIncidents,
    resolvedCount: stats.resolvedCount,
    ongoingCount: stats.ongoingCount,
    totalDowntimeSeconds: Math.round(stats.resolvedDowntime + liveDowntime),
    mttr: stats.avgDuration ? Math.round(stats.avgDuration) : null,
    longestIncident: stats.maxDuration || null,
    bySeverity: {
      critical: stats.criticalCount,
      major: stats.majorCount,
      minor: stats.minorCount,
    },
    byStatus: {
      ongoing: stats.ongoingOnlyCount,
      investigating: stats.investigatingCount,
      identified: stats.identifiedCount,
    },
    topAffectedMonitors,
    window,
  };
};
