import { randomUUID } from "node:crypto";
import JobRun from "../models/JobRun.js";
import ApiError from "../utils/ApiError.js";
import logger from "../utils/logger.js";
import { JOB_STATUS, JOB_RUN_STATUS } from "../config/constants.js";
import {
  calculateNextRun,
  calculateNextEvaluation,
  sanitizeRunOutput,
  sanitizeRunMetadata,
} from "./jobSchedule.service.js";
import { handleJobIncident } from "../workers/incidentManager.js";

/**
 * Processes an incoming heartbeat report for a verified JobMonitor.
 *
 * Handles:
 * - started, succeeded, failed events
 * - idempotent duplicate detection
 * - invalid terminal state transitions
 * - single-ping terminal reporting without prior started event
 * - server-side timestamp authority
 * - schedule milestone advancement
 *
 * @param {object} jobMonitor Mongoose document attached by jobHeartbeatAuth
 * @param {object} payload Validated heartbeat payload
 * @param {object} reqContext Context containing IP and User-Agent
 * @returns {Promise<object>} Response summary payload
 */
export const processHeartbeat = async (
  jobMonitor,
  payload,
  reqContext = {},
) => {
  const now = new Date();
  const { event } = payload;

  const idempotencyKey =
    payload.idempotencyKey ||
    reqContext.idempotencyKey ||
    null;

  let runId = payload.runId || idempotencyKey;

  const startedAt = payload.startedAt ? new Date(payload.startedAt) : now;
  const scheduledFor = payload.scheduledFor
    ? new Date(payload.scheduledFor)
    : jobMonitor.nextExpectedAt || startedAt;
  const occurrenceKey = scheduledFor instanceof Date
    ? scheduledFor.toISOString()
    : new Date(scheduledFor).toISOString();

  // If no runId is provided, generate a deterministic stable occurrence identifier
  // rather than a random UUID so that network retries for the same scheduled occurrence are idempotent.
  const deterministicOccurrenceRunId = `occ_${occurrenceKey.replace(/[:.]/g, "-")}_${String(jobMonitor._id).slice(-6)}`;

  // ───────────────────────────────────────────────────────────────────────────
  // EVENT: STARTED
  // ───────────────────────────────────────────────────────────────────────────
  if (event === "started") {
    runId = runId || deterministicOccurrenceRunId;

    // Check for existing run with this runId
    let existingRun = await JobRun.findOne({
      jobMonitor: jobMonitor._id,
      runId,
    });

    if (existingRun) {
      if (existingRun.status === JOB_RUN_STATUS.STARTED) {
        // Recoverable partial failure check: ensure JobMonitor state matches this run
        if (
          jobMonitor.currentRunId !== existingRun.runId ||
          jobMonitor.lastRunStatus !== JOB_RUN_STATUS.STARTED
        ) {
          jobMonitor.currentRunId = existingRun.runId;
          jobMonitor.currentRunStartedAt = existingRun.startedAt;
          jobMonitor.lastRunStatus = JOB_RUN_STATUS.STARTED;
          jobMonitor.lastPingAt = now;
          jobMonitor.lastStartedAt = existingRun.startedAt;
          jobMonitor.nextEvaluationAt = calculateNextEvaluation(
            {
              ...jobMonitor.toObject(),
              currentRunStartedAt: existingRun.startedAt,
              nextExpectedAt: jobMonitor.nextExpectedAt,
            },
            now,
          );
          await jobMonitor.save();
        }

        return {
          duplicate: true,
          message: "Duplicate started heartbeat ignored",
          runId: existingRun.runId,
          status: existingRun.status,
          startedAt: existingRun.startedAt,
        };
      }

      // If existing run is already terminal, cannot transition back to started
      throw ApiError.conflict(
        `Cannot start execution: run "${runId}" is already in terminal state "${existingRun.status}".`,
      );
    }

    // Check if the scheduler already created a synthetic MISSED record for this occurrence.
    // If so, reconcile that missed run instead of creating a split duplicate record!
    let run = await JobRun.findOne({
      jobMonitor: jobMonitor._id,
      status: JOB_RUN_STATUS.MISSED,
      $or: [
        { occurrenceKey },
        { scheduledFor },
      ],
    });

    if (run) {
      run.status = JOB_RUN_STATUS.STARTED;
      run.runId = runId;
      run.startedAt = startedAt;
      run.receivedAt = now;
      run.late = true;
      run.reconciledLate = true;
      run.delaySeconds = Math.max(
        0,
        Math.round(
          (startedAt.getTime() - new Date(run.scheduledFor).getTime()) / 1000,
        ),
      );
      if (payload.output) run.output = sanitizeRunOutput(payload.output);
      if (payload.metadata)
        run.metadata = sanitizeRunMetadata(payload.metadata);
      await run.save();

      // Reverse false missed counters on monitor
      jobMonitor.consecutiveMissed = Math.max(
        0,
        (jobMonitor.consecutiveMissed || 0) - 1,
      );
      jobMonitor.consecutiveFailures = Math.max(
        0,
        (jobMonitor.consecutiveFailures || 0) - 1,
      );
      if (jobMonitor.status === JOB_STATUS.LATE) {
        jobMonitor.status = JOB_STATUS.UP;
      }
    } else {
      try {
        run = await JobRun.create({
          jobMonitor: jobMonitor._id,
          runId,
          occurrenceKey,
          scheduledFor,
          status: JOB_RUN_STATUS.STARTED,
          startedAt,
          receivedAt: now,
          output: sanitizeRunOutput(payload.output),
          metadata: sanitizeRunMetadata(payload.metadata),
          clientIp: reqContext.clientIp,
          userAgent: reqContext.userAgent,
        });
      } catch (err) {
        // Handle concurrent race with duplicate key error (code 11000)
        if (err.code === 11000) {
          existingRun = await JobRun.findOne({
            jobMonitor: jobMonitor._id,
            runId,
          });
          if (existingRun && existingRun.status === JOB_RUN_STATUS.STARTED) {
            return {
              duplicate: true,
              message: "Duplicate started heartbeat ignored",
              runId: existingRun.runId,
              status: existingRun.status,
              startedAt: existingRun.startedAt,
            };
          }
        }
        throw err;
      }
    }

    // Update JobMonitor execution state
    jobMonitor.currentRunId = run.runId;
    jobMonitor.currentRunStartedAt = run.startedAt;
    jobMonitor.lastRunStatus = JOB_RUN_STATUS.STARTED;
    jobMonitor.lastPingAt = now;
    jobMonitor.lastStartedAt = run.startedAt;
    jobMonitor.nextEvaluationAt = calculateNextEvaluation(
      {
        ...jobMonitor.toObject(),
        currentRunStartedAt: run.startedAt,
        nextExpectedAt: jobMonitor.nextExpectedAt,
      },
      now,
    );

    await jobMonitor.save();

    return {
      duplicate: false,
      runId: run.runId,
      status: JOB_RUN_STATUS.STARTED,
      startedAt: run.startedAt,
      nextEvaluationAt: jobMonitor.nextEvaluationAt,
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // EVENT: SUCCEEDED
  // ───────────────────────────────────────────────────────────────────────────
  if (event === "succeeded") {
    let run = null;

    if (runId) {
      run = await JobRun.findOne({ jobMonitor: jobMonitor._id, runId });
    } else if (jobMonitor.currentRunId) {
      // Correlate with active in-flight run if runId wasn't passed
      run = await JobRun.findOne({
        jobMonitor: jobMonitor._id,
        runId: jobMonitor.currentRunId,
      });
    }

    // If still not correlated, check if there is an existing MISSED run for this scheduled occurrence!
    if (!run && (occurrenceKey || payload.scheduledFor)) {
      run = await JobRun.findOne({
        jobMonitor: jobMonitor._id,
        status: JOB_RUN_STATUS.MISSED,
        $or: [
          { occurrenceKey },
          { scheduledFor },
        ],
      });
    }

    if (run) {
      if (run.status === JOB_RUN_STATUS.SUCCEEDED) {
        // Recoverable partial failure check: reconcile JobMonitor if previous attempt failed before save
        if (
          jobMonitor.lastRunStatus !== JOB_RUN_STATUS.SUCCEEDED ||
          jobMonitor.currentRunId === run.runId
        ) {
          const newSuccesses =
            (jobMonitor.consecutiveSuccesses || 0) +
            (jobMonitor.lastRunStatus !== JOB_RUN_STATUS.SUCCEEDED ? 1 : 0);
          jobMonitor.consecutiveSuccesses = newSuccesses;
          jobMonitor.consecutiveFailures = 0;
          jobMonitor.consecutiveMissed = 0;
          if (newSuccesses >= (jobMonitor.recoveryThreshold || 1)) {
            jobMonitor.status = JOB_STATUS.UP;
          }
          jobMonitor.lastRunStatus = JOB_RUN_STATUS.SUCCEEDED;
          jobMonitor.lastPingAt = now;
          jobMonitor.lastFinishedAt = run.completedAt || now;
          jobMonitor.lastDurationMs = run.durationMs;
          jobMonitor.currentRunId = null;
          jobMonitor.currentRunStartedAt = null;
          jobMonitor.nextExpectedAt = calculateNextRun(jobMonitor, now);
          jobMonitor.nextEvaluationAt = calculateNextEvaluation(
            { ...jobMonitor.toObject(), nextExpectedAt: jobMonitor.nextExpectedAt },
            now,
          );
          await jobMonitor.save();
        }

        return {
          duplicate: true,
          message: "Duplicate succeeded heartbeat ignored",
          runId: run.runId,
          status: run.status,
          durationMs: run.durationMs,
        };
      }

      if (
        run.status === JOB_RUN_STATUS.FAILED ||
        run.status === JOB_RUN_STATUS.TIMED_OUT
      ) {
        if (run.status === JOB_RUN_STATUS.TIMED_OUT) {
          run.late = true;
          const completedAt = payload.completedAt ? new Date(payload.completedAt) : now;
          if (run.startedAt) {
            run.delaySeconds = Math.max(
              0,
              Math.round(
                (completedAt.getTime() - new Date(run.startedAt).getTime()) /
                  1000,
              ),
            );
          } else if (run.scheduledFor) {
            run.delaySeconds = Math.max(
              0,
              Math.round(
                (completedAt.getTime() - new Date(run.scheduledFor).getTime()) /
                  1000,
              ),
            );
          }
          if (payload.output) run.output = sanitizeRunOutput(payload.output);
          if (payload.metadata)
            run.metadata = sanitizeRunMetadata(payload.metadata);
          await run.save?.().catch(() => {});
        }
        throw ApiError.conflict(
          `Cannot mark run as succeeded: run "${run.runId}" is already in terminal state "${run.status}".`,
        );
      }

      // If run was previously marked MISSED, reconcile it as late execution
      const wasMissed = run.status === JOB_RUN_STATUS.MISSED;

      // Transition started/missed -> succeeded
      const completedAt = payload.completedAt ? new Date(payload.completedAt) : now;
      let durationMs = payload.durationMs;
      if (durationMs == null && run.startedAt) {
        durationMs = Math.max(
          0,
          completedAt.getTime() - new Date(run.startedAt).getTime(),
        );
      }

      run.status = JOB_RUN_STATUS.SUCCEEDED;
      run.completedAt = completedAt;
      run.durationMs = durationMs ?? null;
      if (runId) run.runId = runId;
      if (wasMissed) {
        run.late = true;
        run.reconciledLate = true;
        run.delaySeconds = Math.max(
          0,
          Math.round(
            (completedAt.getTime() - new Date(run.scheduledFor).getTime()) / 1000,
          ),
        );
        jobMonitor.consecutiveMissed = Math.max(
          0,
          (jobMonitor.consecutiveMissed || 0) - 1,
        );
        jobMonitor.consecutiveFailures = Math.max(
          0,
          (jobMonitor.consecutiveFailures || 0) - 1,
        );
      }
      if (payload.output) run.output = sanitizeRunOutput(payload.output);
      if (payload.metadata)
        run.metadata = sanitizeRunMetadata(payload.metadata);
      if (payload.exitCode !== undefined && payload.exitCode !== null) {
        run.exitCode = payload.exitCode;
      }

      await run.save();
    } else {
      // Single-ping execution: no prior started event
      runId = runId || deterministicOccurrenceRunId;
      const completedAt = payload.completedAt ? new Date(payload.completedAt) : now;
      let execStartedAt = payload.startedAt ? new Date(payload.startedAt) : null;
      let durationMs = payload.durationMs;

      if (!execStartedAt && durationMs != null) {
        execStartedAt = new Date(completedAt.getTime() - durationMs);
      } else if (!execStartedAt) {
        execStartedAt = completedAt;
      }

      if (durationMs == null && execStartedAt) {
        durationMs = Math.max(0, completedAt.getTime() - execStartedAt.getTime());
      }

      try {
        run = await JobRun.create({
          jobMonitor: jobMonitor._id,
          runId,
          occurrenceKey,
          scheduledFor,
          status: JOB_RUN_STATUS.SUCCEEDED,
          startedAt: execStartedAt,
          completedAt,
          receivedAt: now,
          durationMs: durationMs ?? 0,
          exitCode: payload.exitCode ?? 0,
          output: sanitizeRunOutput(payload.output),
          metadata: sanitizeRunMetadata(payload.metadata),
          clientIp: reqContext.clientIp,
          userAgent: reqContext.userAgent,
        });
      } catch (err) {
        if (err.code === 11000) {
          const dup = await JobRun.findOne({
            jobMonitor: jobMonitor._id,
            runId,
          });
          if (dup && dup.status === JOB_RUN_STATUS.SUCCEEDED) {
            return {
              duplicate: true,
              message: "Duplicate succeeded heartbeat ignored",
              runId: dup.runId,
              status: dup.status,
              durationMs: dup.durationMs,
            };
          }
        }
        throw err;
      }
    }

    // Update JobMonitor state & advance schedule
    const newSuccesses = (jobMonitor.consecutiveSuccesses || 0) + 1;
    jobMonitor.consecutiveSuccesses = newSuccesses;
    jobMonitor.consecutiveFailures = 0;
    jobMonitor.consecutiveMissed = 0;

    const recoveryThreshold = jobMonitor.recoveryThreshold || 1;
    let recovered = false;
    if (jobMonitor.status === JOB_STATUS.DOWN) {
      if (newSuccesses >= recoveryThreshold) {
        jobMonitor.status = JOB_STATUS.UP;
        recovered = true;
      }
    } else {
      jobMonitor.status = JOB_STATUS.UP;
    }

    jobMonitor.lastRunStatus = JOB_RUN_STATUS.SUCCEEDED;
    jobMonitor.lastPingAt = now;
    jobMonitor.lastFinishedAt = run.completedAt || now;
    jobMonitor.lastDurationMs = run.durationMs;

    // Check if any other overlapping runs are still in STARTED status
    let remainingActiveRun = null;
    if (typeof JobRun.findOne === "function") {
      try {
        remainingActiveRun = await JobRun.findOne({
          jobMonitor: jobMonitor._id,
          status: JOB_RUN_STATUS.STARTED,
          runId: { $ne: run.runId },
        }).sort({ startedAt: 1, _id: 1 });
      } catch {
        // Mock fallback
      }
    }

    if (remainingActiveRun) {
      jobMonitor.currentRunId = remainingActiveRun.runId;
      jobMonitor.currentRunStartedAt = remainingActiveRun.startedAt;
    } else {
      jobMonitor.currentRunId = null;
      jobMonitor.currentRunStartedAt = null;
    }

    jobMonitor.nextExpectedAt = calculateNextRun(jobMonitor, now);
    jobMonitor.nextEvaluationAt = calculateNextEvaluation(
      {
        ...jobMonitor.toObject(),
        currentRunStartedAt: jobMonitor.currentRunStartedAt,
        nextExpectedAt: jobMonitor.nextExpectedAt,
      },
      now,
    );

    await jobMonitor.save();

    if (recovered) {
      await handleJobIncident(jobMonitor, run, {
        triggerType: "recovery",
        consecutiveSuccesses: newSuccesses,
      }).catch((err) =>
        logger.error("Failed handling job recovery incident", {
          jobMonitorId: String(jobMonitor._id),
          error: err.message,
        }),
      );
    }

    return {
      duplicate: false,
      runId: run.runId,
      status: JOB_RUN_STATUS.SUCCEEDED,
      durationMs: run.durationMs,
      nextExpectedAt: jobMonitor.nextExpectedAt,
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // EVENT: FAILED
  // ───────────────────────────────────────────────────────────────────────────
  if (event === "failed") {
    let run = null;

    if (runId) {
      run = await JobRun.findOne({ jobMonitor: jobMonitor._id, runId });
    } else if (jobMonitor.currentRunId) {
      run = await JobRun.findOne({
        jobMonitor: jobMonitor._id,
        runId: jobMonitor.currentRunId,
      });
    }

    // Check if there is an existing MISSED run for this scheduled occurrence
    if (!run && (occurrenceKey || payload.scheduledFor)) {
      run = await JobRun.findOne({
        jobMonitor: jobMonitor._id,
        status: JOB_RUN_STATUS.MISSED,
        $or: [
          { occurrenceKey },
          { scheduledFor },
        ],
      });
    }

    const errorMessage =
      payload.failureMessage ||
      payload.errorMessage ||
      "External job reported execution failure.";

    if (run) {
      if (run.status === JOB_RUN_STATUS.FAILED) {
        // Recoverable partial failure check: reconcile JobMonitor if previous attempt failed before save
        if (
          jobMonitor.lastRunStatus !== JOB_RUN_STATUS.FAILED ||
          jobMonitor.currentRunId === run.runId
        ) {
          const newFailures =
            (jobMonitor.consecutiveFailures || 0) +
            (jobMonitor.lastRunStatus !== JOB_RUN_STATUS.FAILED ? 1 : 0);
          jobMonitor.consecutiveFailures = newFailures;
          jobMonitor.consecutiveSuccesses = 0;
          if (newFailures >= (jobMonitor.failureThreshold || 1)) {
            jobMonitor.status = JOB_STATUS.DOWN;
          }
          jobMonitor.lastRunStatus = JOB_RUN_STATUS.FAILED;
          jobMonitor.lastPingAt = now;
          jobMonitor.lastFinishedAt = run.completedAt || now;
          jobMonitor.lastDurationMs = run.durationMs;
          jobMonitor.currentRunId = null;
          jobMonitor.currentRunStartedAt = null;
          jobMonitor.nextExpectedAt = calculateNextRun(jobMonitor, now);
          jobMonitor.nextEvaluationAt = calculateNextEvaluation(
            { ...jobMonitor.toObject(), nextExpectedAt: jobMonitor.nextExpectedAt },
            now,
          );
          await jobMonitor.save();
        }

        return {
          duplicate: true,
          message: "Duplicate failed heartbeat ignored",
          runId: run.runId,
          status: run.status,
          errorMessage: run.errorMessage,
        };
      }

      if (
        run.status === JOB_RUN_STATUS.SUCCEEDED ||
        run.status === JOB_RUN_STATUS.TIMED_OUT
      ) {
        if (run.status === JOB_RUN_STATUS.TIMED_OUT) {
          run.late = true;
          const completedAt = payload.completedAt ? new Date(payload.completedAt) : now;
          if (run.startedAt) {
            run.delaySeconds = Math.max(
              0,
              Math.round(
                (completedAt.getTime() - new Date(run.startedAt).getTime()) /
                  1000,
              ),
            );
          } else if (run.scheduledFor) {
            run.delaySeconds = Math.max(
              0,
              Math.round(
                (completedAt.getTime() - new Date(run.scheduledFor).getTime()) /
                  1000,
              ),
            );
          }
          if (payload.output) run.output = sanitizeRunOutput(payload.output);
          if (payload.metadata)
            run.metadata = sanitizeRunMetadata(payload.metadata);
          await run.save?.().catch(() => {});
        }
        throw ApiError.conflict(
          `Cannot mark run as failed: run "${run.runId}" is already in terminal state "${run.status}".`,
        );
      }

      const wasMissed = run.status === JOB_RUN_STATUS.MISSED;
      const completedAt = payload.completedAt ? new Date(payload.completedAt) : now;
      let durationMs = payload.durationMs;
      if (durationMs == null && run.startedAt) {
        durationMs = Math.max(
          0,
          completedAt.getTime() - new Date(run.startedAt).getTime(),
        );
      }

      run.status = JOB_RUN_STATUS.FAILED;
      run.completedAt = completedAt;
      run.durationMs = durationMs ?? null;
      run.errorMessage = errorMessage;
      if (runId) run.runId = runId;
      if (wasMissed) {
        run.late = true;
        run.reconciledLate = true;
        run.delaySeconds = Math.max(
          0,
          Math.round(
            (completedAt.getTime() - new Date(run.scheduledFor).getTime()) / 1000,
          ),
        );
        jobMonitor.consecutiveMissed = Math.max(
          0,
          (jobMonitor.consecutiveMissed || 0) - 1,
        );
      }
      if (payload.failureReason) run.failureReason = payload.failureReason;
      if (payload.output) run.output = sanitizeRunOutput(payload.output);
      if (payload.metadata)
        run.metadata = sanitizeRunMetadata(payload.metadata);
      if (payload.exitCode !== undefined && payload.exitCode !== null) {
        run.exitCode = payload.exitCode;
      }

      await run.save();
    } else {
      // Single-ping failure: no prior started event
      runId = runId || deterministicOccurrenceRunId;
      const completedAt = payload.completedAt ? new Date(payload.completedAt) : now;
      let execStartedAt = payload.startedAt ? new Date(payload.startedAt) : null;
      let durationMs = payload.durationMs;

      if (!execStartedAt && durationMs != null) {
        execStartedAt = new Date(completedAt.getTime() - durationMs);
      } else if (!execStartedAt) {
        execStartedAt = completedAt;
      }

      if (durationMs == null && execStartedAt) {
        durationMs = Math.max(0, completedAt.getTime() - execStartedAt.getTime());
      }

      try {
        run = await JobRun.create({
          jobMonitor: jobMonitor._id,
          runId,
          occurrenceKey,
          scheduledFor,
          status: JOB_RUN_STATUS.FAILED,
          startedAt: execStartedAt,
          completedAt,
          receivedAt: now,
          durationMs: durationMs ?? 0,
          exitCode: payload.exitCode ?? 1,
          errorMessage,
          failureReason: payload.failureReason || null,
          output: sanitizeRunOutput(payload.output),
          metadata: sanitizeRunMetadata(payload.metadata),
          clientIp: reqContext.clientIp,
          userAgent: reqContext.userAgent,
        });
      } catch (err) {
        if (err.code === 11000) {
          const dup = await JobRun.findOne({
            jobMonitor: jobMonitor._id,
            runId,
          });
          if (dup && dup.status === JOB_RUN_STATUS.FAILED) {
            return {
              duplicate: true,
              message: "Duplicate failed heartbeat ignored",
              runId: dup.runId,
              status: dup.status,
              errorMessage: dup.errorMessage,
            };
          }
        }
        throw err;
      }
    }

    // Update JobMonitor state & advance schedule
    const newFailures = (jobMonitor.consecutiveFailures || 0) + 1;
    jobMonitor.consecutiveFailures = newFailures;
    jobMonitor.consecutiveSuccesses = 0;

    const failureThreshold = jobMonitor.failureThreshold || 1;
    let failed = false;
    if (newFailures >= failureThreshold) {
      jobMonitor.status = JOB_STATUS.DOWN;
      failed = true;
    }

    jobMonitor.lastRunStatus = JOB_RUN_STATUS.FAILED;
    jobMonitor.lastPingAt = now;
    jobMonitor.lastFinishedAt = run.completedAt || now;
    jobMonitor.lastDurationMs = run.durationMs;

    // Check if any other overlapping runs are still in STARTED status
    let remainingActiveRun = null;
    if (typeof JobRun.findOne === "function") {
      try {
        remainingActiveRun = await JobRun.findOne({
          jobMonitor: jobMonitor._id,
          status: JOB_RUN_STATUS.STARTED,
          runId: { $ne: run.runId },
        }).sort({ startedAt: 1, _id: 1 });
      } catch {
        // Mock fallback
      }
    }

    if (remainingActiveRun) {
      jobMonitor.currentRunId = remainingActiveRun.runId;
      jobMonitor.currentRunStartedAt = remainingActiveRun.startedAt;
    } else {
      jobMonitor.currentRunId = null;
      jobMonitor.currentRunStartedAt = null;
    }

    jobMonitor.nextExpectedAt = calculateNextRun(jobMonitor, now);
    jobMonitor.nextEvaluationAt = calculateNextEvaluation(
      {
        ...jobMonitor.toObject(),
        currentRunStartedAt: jobMonitor.currentRunStartedAt,
        nextExpectedAt: jobMonitor.nextExpectedAt,
      },
      now,
    );

    await jobMonitor.save();

    if (failed) {
      await handleJobIncident(jobMonitor, run, {
        triggerType: "failure",
        failureReason: run.failureReason || run.errorMessage,
        consecutiveFailures: newFailures,
      }).catch((err) =>
        logger.error("Failed handling job failure incident", {
          jobMonitorId: String(jobMonitor._id),
          error: err.message,
        }),
      );
    }

    return {
      duplicate: false,
      runId: run.runId,
      status: JOB_RUN_STATUS.FAILED,
      errorMessage: run.errorMessage,
      nextExpectedAt: jobMonitor.nextExpectedAt,
    };
  }

  throw ApiError.badRequest(`Unsupported heartbeat event "${event}"`);
};
