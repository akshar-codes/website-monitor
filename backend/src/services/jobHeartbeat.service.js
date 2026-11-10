import { randomUUID } from "node:crypto";
import JobRun from "../models/JobRun.js";
import ApiError from "../utils/ApiError.js";
import { JOB_STATUS, JOB_RUN_STATUS } from "../config/constants.js";
import {
  calculateNextRun,
  calculateNextEvaluation,
  sanitizeRunOutput,
  sanitizeRunMetadata,
} from "./jobSchedule.service.js";

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
  let runId = payload.runId;

  // ───────────────────────────────────────────────────────────────────────────
  // EVENT: STARTED
  // ───────────────────────────────────────────────────────────────────────────
  if (event === "started") {
    runId = runId || randomUUID();

    // Check for existing run with this runId
    let existingRun = await JobRun.findOne({
      jobMonitor: jobMonitor._id,
      runId,
    });

    if (existingRun) {
      if (existingRun.status === JOB_RUN_STATUS.STARTED) {
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

    const startedAt = payload.startedAt || now;
    const scheduledFor =
      payload.scheduledFor || jobMonitor.nextExpectedAt || startedAt;

    let run;
    try {
      run = await JobRun.create({
        jobMonitor: jobMonitor._id,
        runId,
        occurrenceKey: scheduledFor.toISOString(),
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

    if (run) {
      if (run.status === JOB_RUN_STATUS.SUCCEEDED) {
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
        run.status === JOB_RUN_STATUS.TIMED_OUT ||
        run.status === JOB_RUN_STATUS.MISSED
      ) {
        throw ApiError.conflict(
          `Cannot mark run as succeeded: run "${run.runId}" is already in terminal state "${run.status}".`,
        );
      }

      // Transition started -> succeeded
      const completedAt = payload.completedAt || now;
      let durationMs = payload.durationMs;
      if (durationMs == null && run.startedAt) {
        durationMs = Math.max(
          0,
          completedAt.getTime() - run.startedAt.getTime(),
        );
      }

      run.status = JOB_RUN_STATUS.SUCCEEDED;
      run.completedAt = completedAt;
      run.durationMs = durationMs ?? null;
      if (payload.output) run.output = sanitizeRunOutput(payload.output);
      if (payload.metadata)
        run.metadata = sanitizeRunMetadata(payload.metadata);
      if (payload.exitCode !== undefined && payload.exitCode !== null) {
        run.exitCode = payload.exitCode;
      }

      await run.save();
    } else {
      // Single-ping execution: no prior started event
      runId = runId || randomUUID();
      const completedAt = payload.completedAt || now;
      let startedAt = payload.startedAt;
      let durationMs = payload.durationMs;

      if (!startedAt && durationMs != null) {
        startedAt = new Date(completedAt.getTime() - durationMs);
      } else if (!startedAt) {
        startedAt = completedAt;
      }

      if (durationMs == null && startedAt) {
        durationMs = Math.max(0, completedAt.getTime() - startedAt.getTime());
      }

      const scheduledFor =
        payload.scheduledFor || jobMonitor.nextExpectedAt || completedAt;

      try {
        run = await JobRun.create({
          jobMonitor: jobMonitor._id,
          runId,
          occurrenceKey: scheduledFor.toISOString(),
          scheduledFor,
          status: JOB_RUN_STATUS.SUCCEEDED,
          startedAt,
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
    jobMonitor.status = JOB_STATUS.UP;
    jobMonitor.lastRunStatus = JOB_RUN_STATUS.SUCCEEDED;
    jobMonitor.lastPingAt = now;
    jobMonitor.lastFinishedAt = run.completedAt || now;
    jobMonitor.lastDurationMs = run.durationMs;
    jobMonitor.consecutiveSuccesses += 1;
    jobMonitor.consecutiveFailures = 0;
    jobMonitor.consecutiveMissed = 0;
    jobMonitor.currentRunId = null;
    jobMonitor.currentRunStartedAt = null;

    jobMonitor.nextExpectedAt = calculateNextRun(jobMonitor, now);
    jobMonitor.nextEvaluationAt = calculateNextEvaluation(
      { ...jobMonitor.toObject(), nextExpectedAt: jobMonitor.nextExpectedAt },
      now,
    );

    await jobMonitor.save();

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

    const errorMessage =
      payload.failureMessage ||
      payload.errorMessage ||
      "External job reported execution failure.";

    if (run) {
      if (run.status === JOB_RUN_STATUS.FAILED) {
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
        run.status === JOB_RUN_STATUS.TIMED_OUT ||
        run.status === JOB_RUN_STATUS.MISSED
      ) {
        throw ApiError.conflict(
          `Cannot mark run as failed: run "${run.runId}" is already in terminal state "${run.status}".`,
        );
      }

      const completedAt = payload.completedAt || now;
      let durationMs = payload.durationMs;
      if (durationMs == null && run.startedAt) {
        durationMs = Math.max(
          0,
          completedAt.getTime() - run.startedAt.getTime(),
        );
      }

      run.status = JOB_RUN_STATUS.FAILED;
      run.completedAt = completedAt;
      run.durationMs = durationMs ?? null;
      run.errorMessage = errorMessage;
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
      runId = runId || randomUUID();
      const completedAt = payload.completedAt || now;
      let startedAt = payload.startedAt;
      let durationMs = payload.durationMs;

      if (!startedAt && durationMs != null) {
        startedAt = new Date(completedAt.getTime() - durationMs);
      } else if (!startedAt) {
        startedAt = completedAt;
      }

      if (durationMs == null && startedAt) {
        durationMs = Math.max(0, completedAt.getTime() - startedAt.getTime());
      }

      const scheduledFor =
        payload.scheduledFor || jobMonitor.nextExpectedAt || completedAt;

      try {
        run = await JobRun.create({
          jobMonitor: jobMonitor._id,
          runId,
          occurrenceKey: scheduledFor.toISOString(),
          scheduledFor,
          status: JOB_RUN_STATUS.FAILED,
          startedAt,
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
    jobMonitor.status = JOB_STATUS.DOWN;
    jobMonitor.lastRunStatus = JOB_RUN_STATUS.FAILED;
    jobMonitor.lastPingAt = now;
    jobMonitor.lastFinishedAt = run.completedAt || now;
    jobMonitor.lastDurationMs = run.durationMs;
    jobMonitor.consecutiveFailures += 1;
    jobMonitor.consecutiveSuccesses = 0;
    jobMonitor.currentRunId = null;
    jobMonitor.currentRunStartedAt = null;

    jobMonitor.nextExpectedAt = calculateNextRun(jobMonitor, now);
    jobMonitor.nextEvaluationAt = calculateNextEvaluation(
      { ...jobMonitor.toObject(), nextExpectedAt: jobMonitor.nextExpectedAt },
      now,
    );

    await jobMonitor.save();

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
