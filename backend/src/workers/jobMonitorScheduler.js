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
  { now = new Date(), token = null } = {},
) => {
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

  const evaluationDate = now instanceof Date ? now : new Date(now);

  // ───────────────────────────────────────────────────────────────────────────
  // 1. EXECUTION TIMEOUT EVALUATION
  // ───────────────────────────────────────────────────────────────────────────
  if (jobMonitor.currentRunStartedAt) {
    const startedAtMs = new Date(jobMonitor.currentRunStartedAt).getTime();
    const timeoutMs =
      (jobMonitor.runTimeoutSeconds ||
        JOB_MONITOR_LIMITS.DEFAULT_RUN_TIMEOUT_SECONDS) * 1000;

    if (evaluationDate.getTime() >= startedAtMs + timeoutMs) {
      const durationMs = Math.max(0, evaluationDate.getTime() - startedAtMs);

      // Attempt atomic transition on JobRun: only if it is still in STARTED state
      let activeRun = null;
      if (jobMonitor.currentRunId) {
        activeRun = await JobRun.findOneAndUpdate(
          {
            jobMonitor: jobMonitor._id,
            runId: jobMonitor.currentRunId,
            status: JOB_RUN_STATUS.STARTED,
          },
          {
            $set: {
              status: JOB_RUN_STATUS.TIMED_OUT,
              completedAt: evaluationDate,
              durationMs,
              errorMessage: `Execution timed out after exceeding configured limit of ${jobMonitor.runTimeoutSeconds} seconds.`,
              failureReason: "execution_timeout",
            },
          },
          { returnDocument: "after" },
        );
      }

      if (activeRun) {
        metrics.timedOutRuns += 1;
        jobMonitor.lastRunStatus = JOB_RUN_STATUS.TIMED_OUT;
        jobMonitor.lastFinishedAt = evaluationDate;
        jobMonitor.lastDurationMs = durationMs;
        jobMonitor.consecutiveFailures =
          (jobMonitor.consecutiveFailures || 0) + 1;
        jobMonitor.consecutiveSuccesses = 0;
        jobMonitor.currentRunId = null;
        jobMonitor.currentRunStartedAt = null;

        const failureThreshold =
          jobMonitor.failureThreshold ||
          JOB_MONITOR_LIMITS.DEFAULT_FAILURE_THRESHOLD;
        if (jobMonitor.consecutiveFailures >= failureThreshold) {
          jobMonitor.status = JOB_STATUS.DOWN;
        }
      } else {
        // Run already transitioned or cleared concurrently
        jobMonitor.currentRunId = null;
        jobMonitor.currentRunStartedAt = null;
      }
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 2. MISSED EXECUTION EVALUATION & BOUNDED CATCH-UP
  // ───────────────────────────────────────────────────────────────────────────
  const MAX_CATCHUP_RUNS = 5;
  let newMissedCount = 0;
  const graceMs =
    (jobMonitor.gracePeriodSeconds ||
      JOB_MONITOR_LIMITS.DEFAULT_GRACE_PERIOD_SECONDS) * 1000;

  if (jobMonitor.nextExpectedAt) {
    let occurrence = new Date(jobMonitor.nextExpectedAt);

    while (
      newMissedCount < MAX_CATCHUP_RUNS &&
      evaluationDate.getTime() >= occurrence.getTime() + graceMs
    ) {
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
        try {
          await JobRun.create({
            jobMonitor: jobMonitor._id,
            runId: deterministicRunId,
            occurrenceKey: occurrenceIso,
            scheduledFor: occurrence,
            status: JOB_RUN_STATUS.MISSED,
            startedAt: null,
            completedAt: evaluationDate,
            receivedAt: evaluationDate,
            durationMs: 0,
            errorMessage: `Scheduled execution was missed. Expected by ${new Date(occurrence.getTime() + graceMs).toISOString()} (grace period: ${jobMonitor.gracePeriodSeconds}s).`,
            failureReason: "missed_execution",
          });

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
      } else if (jobMonitor.status !== JOB_STATUS.DOWN) {
        jobMonitor.status = JOB_STATUS.LATE;
      }
    }

    // Advance nextExpectedAt
    if (occurrence.getTime() + graceMs <= evaluationDate.getTime()) {
      // Reached MAX_CATCHUP_RUNS or occurrence is still in the past: jump strictly to next future occurrence
      jobMonitor.nextExpectedAt = calculateNextRun(jobMonitor, evaluationDate);
    } else {
      jobMonitor.nextExpectedAt = occurrence;
    }
  } else {
    // If nextExpectedAt was not set, initialize to next occurrence from now
    jobMonitor.nextExpectedAt = calculateNextRun(jobMonitor, evaluationDate);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 3. SCHEDULE MILESTONE ADVANCEMENT & LEASE RELEASE
  // ───────────────────────────────────────────────────────────────────────────
  jobMonitor.nextEvaluationAt = calculateNextEvaluation(
    {
      ...jobMonitor.toObject(),
      currentRunStartedAt: jobMonitor.currentRunStartedAt,
      nextExpectedAt: jobMonitor.nextExpectedAt,
    },
    evaluationDate,
  );

  await JobMonitor.updateOne(
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

  let timeout;
  let heartbeat;

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

    const work = evaluateJobMonitor(jobMonitor._id, { now: new Date(), token });

    const deadline = new Promise((_, reject) => {
      timeout = setTimeout(
        () => reject(new Error("Job monitor evaluation exceeded lease timeout")),
        env.JOB_SCHEDULER_LEASE_MS - 5000,
      );
      timeout.unref?.();
    });

    const result = await Promise.race([work, deadline]);
    return result;
  } catch (error) {
    metrics.failedSchedulerOperations += 1;
    logger.error("Job monitor evaluation job failed", {
      jobMonitorId: id,
      jobMonitorName: jobMonitor.name,
      error: error.message,
    });

    await JobMonitor.updateOne(query, {
      $set: {
        retryAt: new Date(Date.now() + env.JOB_SCHEDULER_RETRY_DELAY_MS),
      },
      $unset: { leaseToken: 1, leaseUntil: 1 },
    });

    return null;
  } finally {
    clearTimeout(timeout);
    clearInterval(heartbeat);
    inFlightJobMonitorIds.delete(id);
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
