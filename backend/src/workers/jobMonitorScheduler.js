import { randomUUID } from "node:crypto";
import JobMonitor from "../models/JobMonitor.js";
import JobRun from "../models/JobRun.js";
import env from "../config/env.js";
import logger from "../utils/logger.js";
import {
  JOB_STATUS,
  JOB_RUN_STATUS,
  JOB_MONITOR_LIMITS,
} from "../config/constants.js";
import {
  calculateNextRun,
  calculateNextEvaluation,
} from "../services/jobSchedule.service.js";
import { handleJobIncident } from "./incidentManager.js";

let intervalId = null;
let stopped = true;
let tickPromise = null;

export const inFlightJobMonitorIds = new Set();
export const activeTasks = new Set();

export const metrics = {
  dueJobCount: 0,
  activeWorkers: 0,
  evaluationsCompleted: 0,
  missedExecutions: 0,
  timedOutRuns: 0,
  failedSchedulerOperations: 0,
  leaseExpirationsRecovered: 0,
  lastEvaluationAt: null,
  lastSuccessAt: null,
};

export const resetMetrics = () => {
  metrics.dueJobCount = 0;
  metrics.activeWorkers = 0;
  metrics.evaluationsCompleted = 0;
  metrics.missedExecutions = 0;
  metrics.timedOutRuns = 0;
  metrics.failedSchedulerOperations = 0;
  metrics.leaseExpirationsRecovered = 0;
  metrics.lastEvaluationAt = null;
  metrics.lastSuccessAt = null;
};

/**
 * Atomically claims the next due JobMonitor by updating its distributed lease fields.
 * Prevents multiple scheduler instances from evaluating the same job occurrence.
 *
 * @returns {Promise<{ jobMonitor: object, token: string }|null>}
 */
export const claimNextDueJobMonitor = async () => {
  const now = new Date();
  const token = randomUUID();

  const prev = await JobMonitor.findOneAndUpdate(
    {
      active: true,
      status: { $ne: JOB_STATUS.PAUSED },
      $and: [
        {
          $or: [
            { nextEvaluationAt: { $lte: now } },
            { nextEvaluationAt: null },
            { nextEvaluationAt: { $exists: false } },
          ],
        },
        {
          $or: [
            { leaseUntil: null },
            { leaseUntil: { $exists: false } },
            { leaseUntil: { $lte: now } },
          ],
        },
        {
          $or: [
            { retryAt: null },
            { retryAt: { $exists: false } },
            { retryAt: { $lte: now } },
          ],
        },
      ],
    },
    {
      $set: {
        leaseToken: token,
        leaseUntil: new Date(now.getTime() + env.JOB_SCHEDULER_LEASE_MS),
      },
    },
    {
      sort: { nextEvaluationAt: 1, _id: 1 },
      returnDocument: "before",
      select: "+leaseToken +leaseUntil +retryAt",
    },
  );

  if (!prev) return null;

  // Track if we recovered an expired lease from a dead or crashed worker
  if (prev.leaseUntil && new Date(prev.leaseUntil) <= now) {
    metrics.leaseExpirationsRecovered += 1;
  }

  // Update in-memory reference to claimed state
  prev.leaseToken = token;
  prev.leaseUntil = new Date(now.getTime() + env.JOB_SCHEDULER_LEASE_MS);

  return { jobMonitor: prev, token };
};

/**
 * Core evaluation engine for a JobMonitor.
 * Evaluates:
 * 1. Execution timeouts for in-flight runs exceeding runTimeoutSeconds.
 * 2. Missed scheduled occurrences past scheduledFor + gracePeriodSeconds.
 * 3. Schedule milestone recalculation and failure/recovery threshold application.
 *
 * Multi-instance safe and idempotent.
 *
 * @param {string|mongoose.Types.ObjectId} jobMonitorId
 * @param {object} [options]
 * @param {Date} [options.now=new Date()]
 * @param {string} [options.token=null]
 * @returns {Promise<object|null>} Updated JobMonitor document
 */
export const evaluateJobMonitor = async (
  jobMonitorId,
  { now = new Date(), token = null, signal = null } = {},
) => {
  if (signal?.aborted) return null;
  metrics.lastEvaluationAt = new Date();

  const query = token
    ? { _id: jobMonitorId, leaseToken: token }
    : { _id: jobMonitorId };

  const jobMonitor = await JobMonitor.findOne(query).select(
    "+leaseToken +leaseUntil +retryAt",
  );

  if (!jobMonitor) {
    return null;
  }

  // If paused or deactivated, release lease and clear nextEvaluationAt
  if (!jobMonitor.active || jobMonitor.status === JOB_STATUS.PAUSED) {
    await JobMonitor.updateOne(
      { _id: jobMonitor._id, ...(token ? { leaseToken: token } : {}) },
      {
        $unset: { leaseToken: 1, leaseUntil: 1, retryAt: 1 },
        $set: { nextEvaluationAt: null },
      },
    );
    return null;
  }

  if (signal?.aborted) return null;
  const evaluationDate = now instanceof Date ? now : new Date(now);

  const isLeaseValid = async () => {
    if (signal?.aborted) return false;
    if (!token) return true;
    try {
      const doc = await JobMonitor.findOne({
        _id: jobMonitor._id,
        leaseToken: token,
      }).select("+leaseToken +leaseUntil");
      if (!doc) return false;
      if (doc.leaseUntil && new Date(doc.leaseUntil).getTime() < Date.now()) {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  };

  // ───────────────────────────────────────────────────────────────────────────
  // 1. EXECUTION TIMEOUT EVALUATION (Evaluates all in-flight started runs)
  // ───────────────────────────────────────────────────────────────────────────
  const timeoutMs =
    (jobMonitor.runTimeoutSeconds ||
      JOB_MONITOR_LIMITS.DEFAULT_RUN_TIMEOUT_SECONDS) * 1000;
  const timeoutCutoff = new Date(evaluationDate.getTime() - timeoutMs);

  let timedOutCandidates = [];
  if (typeof JobRun.find === "function") {
    try {
      const found = await JobRun.find({
        jobMonitor: jobMonitor._id,
        status: JOB_RUN_STATUS.STARTED,
        startedAt: { $lte: timeoutCutoff },
      });
      if (Array.isArray(found)) {
        timedOutCandidates = [...found];
      }
    } catch {
      // Fallback for mocks
    }
  }

  // Also include currentRunId if set on jobMonitor and timed out
  if (
    jobMonitor.currentRunStartedAt &&
    jobMonitor.currentRunId &&
    new Date(jobMonitor.currentRunStartedAt).getTime() <= timeoutCutoff.getTime() &&
    !timedOutCandidates.some((r) => r.runId === jobMonitor.currentRunId)
  ) {
    timedOutCandidates.push({
      jobMonitor: jobMonitor._id,
      runId: jobMonitor.currentRunId,
      startedAt: jobMonitor.currentRunStartedAt,
    });
  }

  for (const candidate of timedOutCandidates) {
    if (signal?.aborted || !(await isLeaseValid())) return null;
    const startedAtMs = new Date(candidate.startedAt || evaluationDate).getTime();
    const durationMs = Math.max(0, evaluationDate.getTime() - startedAtMs);

    const runQuery = candidate._id
      ? { _id: candidate._id, status: JOB_RUN_STATUS.STARTED }
      : {
          jobMonitor: jobMonitor._id,
          runId: candidate.runId,
          status: JOB_RUN_STATUS.STARTED,
        };

    const activeRun = await JobRun.findOneAndUpdate(
      runQuery,
      {
        $set: {
          status: JOB_RUN_STATUS.TIMED_OUT,
          completedAt: evaluationDate,
          durationMs,
          appliedToMonitor: true,
          errorMessage: `Execution timed out after exceeding configured limit of ${jobMonitor.runTimeoutSeconds} seconds.`,
          failureReason: "execution_timeout",
        },
      },
      { returnDocument: "after" },
    );

    if (activeRun) {
      if (signal?.aborted || !(await isLeaseValid())) return null;
      metrics.timedOutRuns += 1;
      jobMonitor.lastRunStatus = JOB_RUN_STATUS.TIMED_OUT;
      jobMonitor.lastFinishedAt = evaluationDate;
      jobMonitor.lastDurationMs = durationMs;
      jobMonitor.consecutiveFailures =
        (jobMonitor.consecutiveFailures || 0) + 1;
      jobMonitor.consecutiveSuccesses = 0;

      const failureThreshold =
        jobMonitor.failureThreshold ||
        JOB_MONITOR_LIMITS.DEFAULT_FAILURE_THRESHOLD;
      if (jobMonitor.consecutiveFailures >= failureThreshold) {
        jobMonitor.status = JOB_STATUS.DOWN;
        await handleJobIncident(jobMonitor, activeRun, {
          triggerType: "timeout",
          failureReason: "execution_timeout",
          consecutiveFailures: jobMonitor.consecutiveFailures,
        }).catch((err) =>
          logger.error("Failed handling job timeout incident", {
            jobMonitorId: String(jobMonitor._id),
            error: err.message,
          }),
        );
      }
    }
  }

  // Update currentRunId / currentRunStartedAt based on remaining in-flight runs
  let remainingInFlightRun = null;
  if (typeof JobRun.findOne === "function") {
    try {
      remainingInFlightRun = await JobRun.findOne({
        jobMonitor: jobMonitor._id,
        status: JOB_RUN_STATUS.STARTED,
      }).sort({ startedAt: 1, _id: 1 });
    } catch {
      // Mock fallback
    }
  }

  if (remainingInFlightRun) {
    jobMonitor.currentRunId = remainingInFlightRun.runId;
    jobMonitor.currentRunStartedAt = remainingInFlightRun.startedAt;
  } else if (
    !jobMonitor.currentRunStartedAt ||
    new Date(jobMonitor.currentRunStartedAt).getTime() <= timeoutCutoff.getTime()
  ) {
    jobMonitor.currentRunId = null;
    jobMonitor.currentRunStartedAt = null;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 2. MISSED EXECUTION EVALUATION & STRICT WORK-BOUNDED CATCH-UP
  // ───────────────────────────────────────────────────────────────────────────
  const MAX_CATCHUP_OCCURRENCES = 5;
  let examinedCount = 0;
  let newMissedCount = 0;
  let lastCreatedMissedRun = null;
  const graceMs =
    (jobMonitor.gracePeriodSeconds ||
      JOB_MONITOR_LIMITS.DEFAULT_GRACE_PERIOD_SECONDS) * 1000;

  let hasMorePastOccurrences = false;

  if (jobMonitor.nextExpectedAt) {
    let occurrence = new Date(jobMonitor.nextExpectedAt);

    while (
      examinedCount < MAX_CATCHUP_OCCURRENCES &&
      evaluationDate.getTime() >= occurrence.getTime() + graceMs
    ) {
      if (signal?.aborted || !(await isLeaseValid())) return null;

      examinedCount += 1;
      const occurrenceIso = occurrence.toISOString();
      const deterministicRunId = `missed_${occurrenceIso.replace(/[:.]/g, "-")}_${String(jobMonitor._id).slice(-6)}`;

      // Check if a qualifying execution started or was recorded for this occurrence
      const existingRun = await JobRun.findOne({
        jobMonitor: jobMonitor._id,
        $or: [
          { occurrenceKey: occurrenceIso },
          { runId: deterministicRunId },
          { scheduledFor: occurrence },
        ],
      });

      // Check if there is an in-flight run started around this occurrence
      const isCurrentlyRunningForOccurrence =
        jobMonitor.currentRunStartedAt &&
        Math.abs(
          new Date(jobMonitor.currentRunStartedAt).getTime() -
            occurrence.getTime(),
        ) <= graceMs;

      if (!existingRun && !isCurrentlyRunningForOccurrence) {
        if (signal?.aborted || !(await isLeaseValid())) return null;
        try {
          const missedRun = await JobRun.create({
            jobMonitor: jobMonitor._id,
            runId: deterministicRunId,
            occurrenceKey: occurrenceIso,
            scheduledFor: occurrence,
            status: JOB_RUN_STATUS.MISSED,
            startedAt: null,
            completedAt: evaluationDate,
            receivedAt: evaluationDate,
            durationMs: 0,
            appliedToMonitor: true,
            errorMessage: `Scheduled execution was missed. Expected by ${new Date(occurrence.getTime() + graceMs).toISOString()} (grace period: ${jobMonitor.gracePeriodSeconds}s).`,
            failureReason: "missed_execution",
          });

          lastCreatedMissedRun = missedRun;
          newMissedCount += 1;
          metrics.missedExecutions += 1;
        } catch (err) {
          // If code 11000, another worker replica created it concurrently
          if (err.code !== 11000) {
            logger.warn("Error creating missed JobRun record", {
              jobMonitorId: String(jobMonitor._id),
              error: err.message,
            });
          }
        }
      }

      // Compute next scheduled occurrence after this one
      try {
        occurrence = calculateNextRun(jobMonitor, occurrence);
      } catch (err) {
        logger.warn(
          "Could not calculate next occurrence during missed evaluation",
          {
            jobMonitorId: String(jobMonitor._id),
            error: err.message,
          },
        );
        break;
      }
    }

    if (newMissedCount > 0) {
      if (signal?.aborted || !(await isLeaseValid())) return null;
      jobMonitor.consecutiveMissed =
        (jobMonitor.consecutiveMissed || 0) + newMissedCount;
      jobMonitor.consecutiveFailures =
        (jobMonitor.consecutiveFailures || 0) + newMissedCount;
      jobMonitor.consecutiveSuccesses = 0;
      jobMonitor.lastRunStatus = JOB_RUN_STATUS.MISSED;
      jobMonitor.lastFinishedAt = evaluationDate;

      const failureThreshold =
        jobMonitor.failureThreshold ||
        JOB_MONITOR_LIMITS.DEFAULT_FAILURE_THRESHOLD;
      if (jobMonitor.consecutiveFailures >= failureThreshold) {
        jobMonitor.status = JOB_STATUS.DOWN;
        await handleJobIncident(jobMonitor, lastCreatedMissedRun, {
          triggerType: "missed",
          failureReason: "missed_execution",
          consecutiveFailures: jobMonitor.consecutiveFailures,
        }).catch((err) =>
          logger.error("Failed handling job missed incident", {
            jobMonitorId: String(jobMonitor._id),
            error: err.message,
          }),
        );
      } else if (jobMonitor.status !== JOB_STATUS.DOWN) {
        jobMonitor.status = JOB_STATUS.LATE;
      }
    }

    // Advance nextExpectedAt to the first unexamined occurrence
    jobMonitor.nextExpectedAt = occurrence;
    hasMorePastOccurrences =
      occurrence.getTime() + graceMs <= evaluationDate.getTime();
  } else {
    // If nextExpectedAt was not set, initialize to next occurrence from now
    jobMonitor.nextExpectedAt = calculateNextRun(jobMonitor, evaluationDate);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 3. SCHEDULE MILESTONE ADVANCEMENT & LEASE RELEASE
  // ───────────────────────────────────────────────────────────────────────────
  if (hasMorePastOccurrences) {
    // Resume catch-up immediately on subsequent scheduler ticks
    jobMonitor.nextEvaluationAt = evaluationDate;
  } else {
    jobMonitor.nextEvaluationAt = calculateNextEvaluation(
      {
        ...jobMonitor.toObject(),
        currentRunStartedAt: jobMonitor.currentRunStartedAt,
        nextExpectedAt: jobMonitor.nextExpectedAt,
      },
      evaluationDate,
    );
  }

  if (signal?.aborted || !(await isLeaseValid())) return null;

  const updateResult = await JobMonitor.updateOne(
    { _id: jobMonitor._id, ...(token ? { leaseToken: token } : {}) },
    {
      $set: {
        status: jobMonitor.status,
        lastRunStatus: jobMonitor.lastRunStatus,
        lastFinishedAt: jobMonitor.lastFinishedAt,
        lastDurationMs: jobMonitor.lastDurationMs,
        consecutiveFailures: jobMonitor.consecutiveFailures,
        consecutiveMissed: jobMonitor.consecutiveMissed,
        consecutiveSuccesses: jobMonitor.consecutiveSuccesses,
        currentRunId: jobMonitor.currentRunId,
        currentRunStartedAt: jobMonitor.currentRunStartedAt,
        nextExpectedAt: jobMonitor.nextExpectedAt,
        nextEvaluationAt: jobMonitor.nextEvaluationAt,
      },
      $unset: {
        leaseToken: 1,
        leaseUntil: 1,
        retryAt: 1,
      },
    },
  );

  if (token && updateResult?.matchedCount === 0) {
    logger.warn("Job monitor lease lost or expired during evaluation", {
      jobMonitorId: String(jobMonitor._id),
      token,
    });
    return null;
  }

  metrics.evaluationsCompleted += 1;
  metrics.lastSuccessAt = new Date();

  return jobMonitor;
};

/**
 * Runs execution evaluation for a claimed JobMonitor with heartbeat lease renewal
 * and timeout deadline boundary.
 *
 * @param {object} claim
 * @param {object} claim.jobMonitor
 * @param {string} claim.token
 * @returns {Promise<object|null>}
 */
export const runClaimedJobMonitor = async ({ jobMonitor, token }) => {
  const id = String(jobMonitor._id);
  if (inFlightJobMonitorIds.has(id)) return null;

  inFlightJobMonitorIds.add(id);
  const query = { _id: jobMonitor._id, leaseToken: token };
  const controller = new AbortController();

  let timeout;
  let heartbeat;
  let workPromise;
  let workPromiseSettled = false;

  try {
    heartbeat = setInterval(
      () => {
        JobMonitor.updateOne(query, {
          $set: {
            leaseUntil: new Date(Date.now() + env.JOB_SCHEDULER_LEASE_MS),
          },
        }).catch((err) =>
          logger.warn("Job monitor lease renewal heartbeat failed", {
            jobMonitorId: id,
            error: err.message,
          }),
        );
      },
      Math.max(1000, Math.floor(env.JOB_SCHEDULER_LEASE_MS / 3)),
    );
    heartbeat.unref?.();

    workPromise = evaluateJobMonitor(jobMonitor._id, {
      now: new Date(),
      token,
      signal: controller.signal,
    }).finally(() => {
      workPromiseSettled = true;
      inFlightJobMonitorIds.delete(id);
    });

    const deadline = new Promise((_, reject) => {
      timeout = setTimeout(
        () =>
          reject(new Error("Job monitor evaluation exceeded lease timeout")),
        env.JOB_SCHEDULER_LEASE_MS - 5000,
      );
      timeout.unref?.();
    });

    const result = await Promise.race([workPromise, deadline]);
    return result;
  } catch (error) {
    metrics.failedSchedulerOperations += 1;
    logger.error("Job monitor evaluation job failed", {
      jobMonitorId: id,
      jobMonitorName: jobMonitor.name,
      error: error.message,
    });

    // Abort active evaluation to prevent stale database writes
    controller.abort();

    // Stop heartbeat lease renewal immediately so lease will expire naturally if work does not drain
    clearInterval(heartbeat);

    // Safely wait for the original evaluation to drain
    if (workPromise && !workPromiseSettled) {
      await Promise.race([
        workPromise.catch(() => {}),
        new Promise((resolve) => setTimeout(resolve, 2000)),
      ]);
    }

    // Fencing rule: do not release ownership while stale work can still create missed runs or incidents.
    // If work has settled cleanly, release the lease and set retryAt.
    // If work did NOT settle within the drain window, retain the lease in MongoDB until natural expiration (leaseUntil)
    // and keep local in-flight tracking alive to prevent concurrent workers from claiming this job.
    if (workPromiseSettled) {
      await JobMonitor.updateOne(query, {
        $set: {
          retryAt: new Date(Date.now() + env.JOB_SCHEDULER_RETRY_DELAY_MS),
        },
        $unset: { leaseToken: 1, leaseUntil: 1 },
      }).catch(() => {});
    } else {
      logger.warn(
        "Job monitor evaluation did not drain within abort timeout; withholding lease release to prevent concurrent executions",
        { jobMonitorId: id, token },
      );
    }

    return null;
  } finally {
    clearTimeout(timeout);
    clearInterval(heartbeat);
    if (workPromiseSettled) {
      inFlightJobMonitorIds.delete(id);
    }
  }
};

/**
 * Single evaluation tick loop with bounded concurrency.
 *
 * @returns {Promise<void>}
 */
export const tick = async () => {
  if (stopped || tickPromise) return tickPromise;

  tickPromise = (async () => {
    try {
      const now = new Date();

      // Count due jobs for metrics
      try {
        metrics.dueJobCount = await JobMonitor.countDocuments({
          active: true,
          status: { $ne: JOB_STATUS.PAUSED },
          $and: [
            {
              $or: [
                { nextEvaluationAt: { $lte: now } },
                { nextEvaluationAt: null },
                { nextEvaluationAt: { $exists: false } },
              ],
            },
            {
              $or: [
                { leaseUntil: null },
                { leaseUntil: { $exists: false } },
                { leaseUntil: { $lte: now } },
              ],
            },
            {
              $or: [
                { retryAt: null },
                { retryAt: { $exists: false } },
                { retryAt: { $lte: now } },
              ],
            },
          ],
        });
      } catch {
        // Non-fatal if count query encounters error
      }

      const available = Math.max(
        0,
        env.JOB_SCHEDULER_CONCURRENCY - activeTasks.size,
      );
      if (available <= 0) return;

      const claims = await Promise.all(
        Array.from({ length: available }, () => claimNextDueJobMonitor()),
      );

      for (const claim of claims.filter(Boolean)) {
        const task = runClaimedJobMonitor(claim)
          .catch((err) => {
            logger.error("Job monitor worker task error", {
              error: err.message,
            });
          })
          .finally(() => {
            activeTasks.delete(task);
            metrics.activeWorkers = activeTasks.size;
          });

        activeTasks.add(task);
        metrics.activeWorkers = activeTasks.size;
      }
    } catch (err) {
      logger.error("Job monitor scheduler tick encountered error", {
        error: err.message,
      });
    } finally {
      tickPromise = null;
    }
  })();

  return tickPromise;
};

/**
 * Starts the periodic JobMonitor evaluation scheduler.
 */
export const start = () => {
  if (!stopped) return;
  stopped = false;

  logger.info("Job monitor scheduler started", {
    tickMs: env.JOB_SCHEDULER_TICK_MS,
    concurrency: env.JOB_SCHEDULER_CONCURRENCY,
    leaseMs: env.JOB_SCHEDULER_LEASE_MS,
  });

  intervalId = setInterval(tick, env.JOB_SCHEDULER_TICK_MS);
  intervalId.unref?.();

  // Initial immediate evaluation tick
  void tick();
};

/**
 * Stops the JobMonitor scheduler gracefully, draining all active evaluation tasks.
 */
export const stop = async () => {
  if (stopped) return;
  stopped = true;

  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }

  if (tickPromise) {
    await tickPromise.catch(() => {});
  }

  if (activeTasks.size > 0) {
    await Promise.allSettled(Array.from(activeTasks));
  }

  metrics.activeWorkers = 0;
  logger.info("Job monitor scheduler stopped");
};
