import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { pruneJobRuns } from "../src/workers/retentionManager.js";
import { jobHeartbeatAuth } from "../src/middlewares/jobHeartbeatAuth.js";
import {
  rotateJobMonitorToken,
  getJobMonitors,
  updateJobMonitor,
} from "../src/services/jobMonitor.service.js";
import {
  generateJobToken,
  calculateNextEvaluation,
} from "../src/services/jobSchedule.service.js";
import { processHeartbeat } from "../src/services/jobHeartbeat.service.js";
import {
  evaluateJobMonitor,
  runClaimedJobMonitor,
} from "../src/workers/jobMonitorScheduler.js";
import JobMonitor from "../src/models/JobMonitor.js";
import JobRun from "../src/models/JobRun.js";
import Incident from "../src/models/Incident.js";
import Activity from "../src/models/Activity.js";
import { JOB_STATUS, JOB_RUN_STATUS, PLANS, ROLES } from "../src/config/constants.js";

const query = (rows) => ({
  select() {
    return this;
  },
  sort() {
    return this;
  },
  skip() {
    return this;
  },
  limit() {
    return this;
  },
  lean: async () => rows,
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. Execution Timeout Scheduling (No Grace Period Added)
// ─────────────────────────────────────────────────────────────────────────────
test("Timeout Scheduling: calculateNextEvaluation evaluates at exact timeout deadline without adding grace period", () => {
  const startedAt = new Date("2026-11-10T12:00:00.000Z");
  const nextExpected = new Date("2026-11-10T14:00:00.000Z");

  const evalDate = calculateNextEvaluation({
    runTimeoutSeconds: 600, // 10 minutes
    gracePeriodSeconds: 300, // 5 minutes grace (should NOT be added to timeout)
    currentRunStartedAt: startedAt,
    nextExpectedAt: nextExpected,
  });

  // Timeout deadline is 12:00 + 10m = 12:10:00.000Z
  assert.equal(evalDate.toISOString(), "2026-11-10T12:10:00.000Z");
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Scheduler Task Abort & Concurrency Fencing
// ─────────────────────────────────────────────────────────────────────────────
test("Scheduler Fencing: evaluateJobMonitor respects AbortSignal and does not commit writes when aborted", async () => {
  const monitorId = new mongoose.Types.ObjectId();
  const controller = new AbortController();
  controller.abort(); // already aborted

  let updateCalled = false;
  const originalUpdateOne = JobMonitor.updateOne;
  JobMonitor.updateOne = async () => {
    updateCalled = true;
    return { matchedCount: 1 };
  };

  try {
    const result = await evaluateJobMonitor(monitorId, {
      token: "test-token",
      signal: controller.signal,
    });

    assert.equal(result, null);
    assert.equal(updateCalled, false);
  } finally {
    JobMonitor.updateOne = originalUpdateOne;
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Overlapping Execution Timeout Tracking
// ─────────────────────────────────────────────────────────────────────────────
test("Overlapping Runs: evaluateJobMonitor detects timeout for older run even if currentRunId points to newer run", async () => {
  const monitorId = new mongoose.Types.ObjectId();
  const evaluationDate = new Date("2026-11-10T12:30:00.000Z");

  // Run 1 started at 12:00 (30m ago, timeout 10m -> timed out)
  // Run 2 started at 12:25 (5m ago, timeout 10m -> still running)
  const run1 = {
    _id: new mongoose.Types.ObjectId(),
    runId: "run-overlap-1",
    status: JOB_RUN_STATUS.STARTED,
    startedAt: new Date("2026-11-10T12:00:00.000Z"),
  };
  const run2 = {
    _id: new mongoose.Types.ObjectId(),
    runId: "run-overlap-2",
    status: JOB_RUN_STATUS.STARTED,
    startedAt: new Date("2026-11-10T12:25:00.000Z"),
  };

  const monitorDoc = {
    _id: monitorId,
    name: "Overlap Job",
    active: true,
    status: JOB_STATUS.UP,
    scheduleType: "interval",
    intervalSeconds: 600,
    gracePeriodSeconds: 120,
    runTimeoutSeconds: 600,
    failureThreshold: 1,
    currentRunId: "run-overlap-2", // Points to newer run!
    currentRunStartedAt: run2.startedAt,
    nextExpectedAt: new Date("2026-11-10T13:00:00.000Z"),
    toObject() {
      return { ...this };
    },
  };

  let timedOutRunId = null;
  const originalJobRunFind = JobRun.find;
  const originalJobRunFindOne = JobRun.findOne;
  const originalJobRunFindOneAndUpdate = JobRun.findOneAndUpdate;
  const originalJobMonitorFindOne = JobMonitor.findOne;
  const originalJobMonitorUpdateOne = JobMonitor.updateOne;
  const originalIncidentUpdateOne = Incident.updateOne;
  const originalIncidentFindOne = Incident.findOne;

  JobMonitor.findOne = () => ({
    select: async () => monitorDoc,
  });

  Incident.updateOne = async () => ({ upsertedCount: 1 });
  Incident.findOne = () => ({ sort: () => null });

  JobRun.find = async (filter) => {
    // Should filter startedAt <= timeoutCutoff (12:20) -> returns run1
    if (filter.status === JOB_RUN_STATUS.STARTED) {
      return [run1];
    }
    return [];
  };

  JobRun.findOneAndUpdate = async (filter, update) => {
    if (String(filter._id) === String(run1._id)) {
      timedOutRunId = run1.runId;
      return { ...run1, status: JOB_RUN_STATUS.TIMED_OUT };
    }
    return null;
  };

  JobRun.findOne = () => ({
    sort: () => run2, // remaining in-flight run
  });

  let savedMonitor = null;
  JobMonitor.updateOne = async (filter, update) => {
    savedMonitor = update.$set;
    return { matchedCount: 1 };
  };

  try {
    await evaluateJobMonitor(monitorId, { now: evaluationDate });

    // Assert Run 1 was timed out
    assert.equal(timedOutRunId, "run-overlap-1");
    // Assert monitor's currentRunId now references the remaining active Run 2
    assert.equal(savedMonitor.currentRunId, "run-overlap-2");
    assert.equal(savedMonitor.lastRunStatus, JOB_RUN_STATUS.TIMED_OUT);
  } finally {
    JobRun.find = originalJobRunFind;
    JobRun.findOne = originalJobRunFindOne;
    JobRun.findOneAndUpdate = originalJobRunFindOneAndUpdate;
    JobMonitor.findOne = originalJobMonitorFindOne;
    JobMonitor.updateOne = originalJobMonitorUpdateOne;
    Incident.updateOne = originalIncidentUpdateOne;
    Incident.findOne = originalIncidentFindOne;
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Heartbeat Idempotency & Partial Failure Recovery
// ─────────────────────────────────────────────────────────────────────────────
test("Heartbeat Idempotency: recovers monitor schedule state on duplicate succeeded heartbeat retry", async () => {
  const monitorId = new mongoose.Types.ObjectId();
  const runId = "run-recover-1";

  const monitorDoc = {
    _id: monitorId,
    name: "Sync Job",
    active: true,
    status: JOB_STATUS.DOWN, // Process crashed before updating status to UP
    lastRunStatus: JOB_RUN_STATUS.FAILED,
    currentRunId: runId, // Still points to this run
    consecutiveSuccesses: 0,
    recoveryThreshold: 1,
    scheduleType: "interval",
    intervalSeconds: 300,
    toObject() {
      return { ...this };
    },
    save: async () => monitorDoc,
  };

  const existingCompletedRun = {
    _id: new mongoose.Types.ObjectId(),
    jobMonitor: monitorId,
    runId,
    status: JOB_RUN_STATUS.SUCCEEDED,
    durationMs: 1500,
    completedAt: new Date(),
  };

  const originalJobRunFindOne = JobRun.findOne;
  JobRun.findOne = async () => existingCompletedRun;

  try {
    const res = await processHeartbeat(monitorDoc, {
      event: "succeeded",
      runId,
    });

    assert.equal(res.duplicate, true);
    // Monitor must be recovered: status set to UP, failures cleared
    assert.equal(monitorDoc.status, JOB_STATUS.UP);
    assert.equal(monitorDoc.lastRunStatus, JOB_RUN_STATUS.SUCCEEDED);
    assert.equal(monitorDoc.consecutiveSuccesses, 1);
    assert.equal(monitorDoc.consecutiveFailures, 0);
  } finally {
    JobRun.findOne = originalJobRunFindOne;
  }
});

test("Heartbeat Idempotency: retry sequence without scheduledFor across persisted schedule advancement produces exactly one run and increments counters once", async () => {
  const monitorId = new mongoose.Types.ObjectId();
  const initialNextExpectedAt = new Date("2026-11-10T12:00:00.000Z");

  const monitorDoc = {
    _id: monitorId,
    active: true,
    status: JOB_STATUS.UP,
    scheduleType: "interval",
    intervalSeconds: 300,
    nextExpectedAt: initialNextExpectedAt,
    consecutiveSuccesses: 0,
    consecutiveFailures: 0,
    recoveryThreshold: 1,
    toObject() {
      return { ...this };
    },
    save: async () => monitorDoc,
  };

  const storedRuns = new Map();
  const originalJobRunFindOne = JobRun.findOne;
  const originalJobRunCreate = JobRun.create;

  JobRun.findOne = async (query) => {
    for (const run of storedRuns.values()) {
      if (query.runId && run.runId === query.runId) return run;
      if (query.$or) {
        for (const condition of query.$or) {
          if (condition.runId && run.runId === condition.runId) return run;
          if (condition.idempotencyKey && run.idempotencyKey === condition.idempotencyKey) return run;
        }
      }
    }
    return null;
  };

  JobRun.create = async (doc) => {
    const runInstance = {
      _id: new mongoose.Types.ObjectId(),
      ...doc,
      save: async () => runInstance,
    };
    storedRuns.set(doc.runId, runInstance);
    return runInstance;
  };

  try {
    // Attempt 1: client reports terminal succeeded with stable runId, but WITHOUT scheduledFor
    const firstResult = await processHeartbeat(monitorDoc, {
      event: "succeeded",
      runId: "stable-run-uuid-1",
      durationMs: 2500,
    });

    assert.equal(firstResult.duplicate, false);
    assert.equal(storedRuns.size, 1);
    assert.equal(monitorDoc.consecutiveSuccesses, 1);

    // Schedule milestone has advanced from 12:00 to 12:05
    const advancedNextExpectedAt = monitorDoc.nextExpectedAt;
    assert.notEqual(advancedNextExpectedAt.getTime(), initialNextExpectedAt.getTime());

    // Attempt 2 (Network Retry): client resends exact same terminal heartbeat without scheduledFor
    // Note: monitorDoc.nextExpectedAt is already advanced to 12:05!
    const retryResult = await processHeartbeat(monitorDoc, {
      event: "succeeded",
      runId: "stable-run-uuid-1",
      durationMs: 2500,
    });

    // Verification:
    // 1. Detected as duplicate
    assert.equal(retryResult.duplicate, true);
    // 2. Exactly one run exists (no duplicate run created)
    assert.equal(storedRuns.size, 1);
    // 3. Consecutive successes counter incremented ONLY ONCE (remains 1, not 2)
    assert.equal(monitorDoc.consecutiveSuccesses, 1);
    // 4. Schedule milestone remains at advancedNextExpectedAt (not advanced further)
    assert.equal(monitorDoc.nextExpectedAt.getTime(), advancedNextExpectedAt.getTime());
  } finally {
    JobRun.findOne = originalJobRunFindOne;
    JobRun.create = originalJobRunCreate;
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Late Execution Reconciles with Existing Missed Run
// ─────────────────────────────────────────────────────────────────────────────
test("Late Execution: started heartbeat reconciles existing synthetic missed run instead of duplicating", async () => {
  const monitorId = new mongoose.Types.ObjectId();
  const scheduledFor = new Date("2026-11-10T12:00:00.000Z");

  const monitorDoc = {
    _id: monitorId,
    active: true,
    status: JOB_STATUS.LATE,
    consecutiveMissed: 1,
    consecutiveFailures: 1,
    scheduleType: "interval",
    intervalSeconds: 300,
    nextExpectedAt: new Date("2026-11-10T12:05:00.000Z"),
    toObject() {
      return { ...this };
    },
    save: async () => monitorDoc,
  };

  const syntheticMissedRun = {
    _id: new mongoose.Types.ObjectId(),
    jobMonitor: monitorId,
    runId: "missed_2026-11-10T12-00-00-000Z_123456",
    occurrenceKey: scheduledFor.toISOString(),
    scheduledFor,
    status: JOB_RUN_STATUS.MISSED,
    save: async () => syntheticMissedRun,
  };

  const originalJobRunFindOne = JobRun.findOne;
  JobRun.findOne = async (filter) => {
    if (filter.status === JOB_RUN_STATUS.MISSED) {
      return syntheticMissedRun;
    }
    return null;
  };

  try {
    const res = await processHeartbeat(monitorDoc, {
      event: "started",
      runId: "external-run-late-999",
      scheduledFor: scheduledFor.toISOString(),
    });

    assert.equal(res.duplicate, false);
    // Missed run transitioned to STARTED with late flags
    assert.equal(syntheticMissedRun.status, JOB_RUN_STATUS.STARTED);
    assert.equal(syntheticMissedRun.late, true);
    assert.equal(syntheticMissedRun.reconciledLate, true);
    assert.equal(syntheticMissedRun.runId, "external-run-late-999");

    // Monitor consecutiveMissed decremented
    assert.equal(monitorDoc.consecutiveMissed, 0);
    assert.equal(monitorDoc.consecutiveFailures, 0);
  } finally {
    JobRun.findOne = originalJobRunFindOne;
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Plan Interval Enforcement Cannot Be Bypassed on Update
// ─────────────────────────────────────────────────────────────────────────────
test("Plan Limits: updateJobMonitor blocks interval update below plan limit when scheduleType omitted", async () => {
  const monitorId = new mongoose.Types.ObjectId();
  const ownerId = new mongoose.Types.ObjectId();

  const existingMonitor = {
    _id: monitorId,
    owner: ownerId,
    scheduleType: "interval",
    intervalSeconds: 300,
  };

  const originalFindOne = JobMonitor.findOne;
  JobMonitor.findOne = () => existingMonitor;

  try {
    const user = { id: String(ownerId), role: ROLES.USER, plan: PLANS.FREE };
    // Free plan minimum interval is 300s. Trying to update to 30s without passing scheduleType!
    let caughtError = null;
    try {
      await updateJobMonitor(monitorId, { intervalSeconds: 30 }, user);
    } catch (err) {
      caughtError = err;
    }

    assert.ok(caughtError);
    assert.equal(caughtError.statusCode, 403);
    assert.match(caughtError.message, /minimum interval of 300 seconds/i);
  } finally {
    JobMonitor.findOne = originalFindOne;
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Retention Prunes Expired Records Completely
// ─────────────────────────────────────────────────────────────────────────────
test("Retention Pruning: pruneJobRuns purges expired runs without leaving expired records behind", async () => {
  const jobMonitorId = new mongoose.Types.ObjectId();
  const cutoff = new Date(Date.now() - 30 * 86_400_000);

  // 25 runs total: 20 newest, 5 expired
  const allRuns = Array.from({ length: 25 }, (_, i) => ({
    _id: `run-${i}`,
    status: JOB_RUN_STATUS.SUCCEEDED,
    createdAt: i < 20 ? new Date() : new Date(Date.now() - 40 * 86_400_000),
  }));

  const fakeJobRun = {
    find(filter) {
      // 1. First query: find 20 newest overall runs
      if (filter && !filter.createdAt) {
        return query(allRuns.slice(0, 20).map((r) => ({ _id: r._id })));
      }
      // 2. Second query: find runs older than cutoff excluding protected recent runs
      if (filter && filter.createdAt && filter.createdAt.$lt) {
        return query(allRuns.slice(20)); // The 5 expired runs
      }
      return query([]);
    },
    async deleteMany(filter) {
      return { deletedCount: filter._id.$in.length };
    },
  };

  const fakeIncident = {
    find: () => query([]),
  };

  const deleted = await pruneJobRuns(jobMonitorId, {
    JobRun: fakeJobRun,
    Incident: fakeIncident,
    cutoff,
    batchSize: 50,
    keep: 20,
  });

  // Exactly the 5 expired runs are deleted. None survive.
  assert.equal(deleted, 5);
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. Token Rotation Expiration & Revocation
// ─────────────────────────────────────────────────────────────────────────────
test("Token Security: jobHeartbeatAuth rejects previous token after 15-minute grace period expires", async () => {
  const monitorId = new mongoose.Types.ObjectId();
  const oldTokenData = generateJobToken();
  const newTokenData = generateJobToken();

  const expiredRotatedAt = new Date(Date.now() - 20 * 60 * 1000);

  const fakeMonitorDoc = {
    _id: monitorId,
    tokenPrefix: newTokenData.prefix,
    tokenHash: newTokenData.tokenHash,
    previousTokenHash: oldTokenData.tokenHash,
    tokenRotatedAt: expiredRotatedAt,
    active: true,
    status: JOB_STATUS.UP,
  };

  const originalFindById = JobMonitor.findById;
  JobMonitor.findById = () => ({
    select: async () => fakeMonitorDoc,
  });

  try {
    const req = {
      params: { jobMonitorId: String(monitorId) },
      headers: { authorization: `Bearer ${oldTokenData.token}` },
    };
    let errorCaught = null;
    await jobHeartbeatAuth(req, {}, (err) => {
      errorCaught = err;
    });

    assert.ok(errorCaught);
    assert.equal(errorCaught.statusCode, 401);
  } finally {
    JobMonitor.findById = originalFindById;
  }
});

test("Token Security: rotateJobMonitorToken supports immediate revocation of previous token", async () => {
  const monitorId = new mongoose.Types.ObjectId();
  const ownerId = new mongoose.Types.ObjectId();
  const oldTokenData = generateJobToken();

  const fakeMonitorDoc = {
    _id: monitorId,
    owner: ownerId,
    name: "Nightly Sync",
    tokenPrefix: oldTokenData.prefix,
    tokenHash: oldTokenData.tokenHash,
    previousTokenHash: null,
    tokenRotatedAt: null,
    save: async () => fakeMonitorDoc,
  };

  const originalFindOne = JobMonitor.findOne;
  const originalActivityCreate = Activity.create;
  JobMonitor.findOne = () => ({
    select: async () => fakeMonitorDoc,
  });
  Activity.create = async () => ({});

  try {
    const user = { id: String(ownerId), role: ROLES.USER };
    const result = await rotateJobMonitorToken(monitorId, { immediateRevoke: true }, user);

    assert.ok(result.token);
    assert.equal(result.previousTokenRevoked, true);
    assert.equal(fakeMonitorDoc.previousTokenHash, null);
  } finally {
    JobMonitor.findOne = originalFindOne;
    Activity.create = originalActivityCreate;
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. Schedule Type Filter in Query Listing
// ─────────────────────────────────────────────────────────────────────────────
test("Job Query API: getJobMonitors filters by scheduleType", async () => {
  const ownerId = new mongoose.Types.ObjectId();
  let capturedFilter = null;

  const originalFind = JobMonitor.find;
  const originalCount = JobMonitor.countDocuments;

  JobMonitor.find = (filter) => {
    capturedFilter = filter;
    return query([]);
  };
  JobMonitor.countDocuments = async () => 0;

  try {
    const user = { id: String(ownerId), role: ROLES.USER };
    await getJobMonitors({ scheduleType: "cron" }, user);

    assert.equal(capturedFilter.scheduleType, "cron");
    assert.equal(String(capturedFilter.owner), String(ownerId));
  } finally {
    JobMonitor.find = originalFind;
    JobMonitor.countDocuments = originalCount;
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. Missed Execution Catch-Up Work Limit
// ─────────────────────────────────────────────────────────────────────────────
test("Missed Execution Catch-Up: bounds examined occurrences to MAX_CATCHUP_OCCURRENCES and resumes on subsequent tick", async () => {
  const monitorId = new mongoose.Types.ObjectId();
  // 60 past occurrences in historical backlog (1 hour of 1-minute intervals)
  const initialNextExpected = new Date("2026-11-10T12:00:00.000Z");
  const evaluationDate = new Date("2026-11-10T13:00:00.000Z");

  const monitorDoc = {
    _id: monitorId,
    name: "High Frequency Sync",
    active: true,
    status: JOB_STATUS.UP,
    scheduleType: "interval",
    intervalSeconds: 60,
    gracePeriodSeconds: 10,
    nextExpectedAt: initialNextExpected,
    toObject() {
      return { ...this };
    },
  };

  let examinedCount = 0;
  const originalJobMonitorFindOne = JobMonitor.findOne;
  const originalJobMonitorUpdateOne = JobMonitor.updateOne;
  const originalJobRunFind = JobRun.find;
  const originalJobRunFindOne = JobRun.findOne;

  JobMonitor.findOne = () => ({
    select: async () => monitorDoc,
  });

  let savedNextExpectedAt = null;
  let savedNextEvaluationAt = null;

  JobMonitor.updateOne = async (_query, update) => {
    savedNextExpectedAt = update.$set.nextExpectedAt;
    savedNextEvaluationAt = update.$set.nextEvaluationAt;
    return { matchedCount: 1 };
  };

  JobRun.find = async () => [];
  // Simulate that existing runs already exist for historical occurrences
  JobRun.findOne = (query) => {
    if (query?.status === JOB_RUN_STATUS.STARTED) {
      return { sort: () => null };
    }
    examinedCount += 1;
    return { runId: "historical-run" };
  };

  try {
    const result = await evaluateJobMonitor(monitorId, {
      now: evaluationDate,
      token: "test-token",
    });

    assert.ok(result);
    // Work bound rule: examined exactly 5 occurrences, not all 60!
    assert.equal(examinedCount, 5);

    // Advanced nextExpectedAt by 5 intervals (5 * 60s = 300s -> 12:05:00.000Z)
    assert.equal(savedNextExpectedAt.toISOString(), "2026-11-10T12:05:00.000Z");

    // Resumes catch-up on subsequent scheduler ticks: nextEvaluationAt scheduled for evaluationDate
    assert.equal(savedNextEvaluationAt.toISOString(), evaluationDate.toISOString());
  } finally {
    JobMonitor.findOne = originalJobMonitorFindOne;
    JobMonitor.updateOne = originalJobMonitorUpdateOne;
    JobRun.find = originalJobRunFind;
    JobRun.findOne = originalJobRunFindOne;
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 11. Scheduler Lease Expiration & Fencing Safety
// ─────────────────────────────────────────────────────────────────────────────
test("Scheduler Lease Safety: evaluateJobMonitor halts and does not commit writes when lease expires or is stolen", async () => {
  const monitorId = new mongoose.Types.ObjectId();
  const evaluationDate = new Date("2026-11-10T12:00:00.000Z");

  const monitorDoc = {
    _id: monitorId,
    name: "Stolen Lease Job",
    active: true,
    status: JOB_STATUS.UP,
    scheduleType: "interval",
    intervalSeconds: 60,
    gracePeriodSeconds: 10,
    nextExpectedAt: new Date("2026-11-10T11:00:00.000Z"),
    leaseToken: "my-token",
    leaseUntil: new Date("2026-11-10T11:59:00.000Z"), // Expired 1 minute ago!
    toObject() {
      return { ...this };
    },
  };

  let updateCalled = false;
  let missedCreated = false;
  const originalJobMonitorFindOne = JobMonitor.findOne;
  const originalJobMonitorUpdateOne = JobMonitor.updateOne;
  const originalJobRunFindOneAndUpdate = JobRun.findOneAndUpdate;
  const originalJobRunFind = JobRun.find;
  const originalJobRunFindOne = JobRun.findOne;

  // First call gets monitorDoc; subsequent lease check queries see expired leaseUntil
  JobMonitor.findOne = () => ({
    select: async () => monitorDoc,
  });

  JobMonitor.updateOne = async () => {
    updateCalled = true;
    return { matchedCount: 1 };
  };

  JobRun.find = async () => [];
  JobRun.findOne = () => ({ sort: () => null });
  JobRun.findOneAndUpdate = async () => {
    missedCreated = true;
    return null;
  };

  try {
    const result = await evaluateJobMonitor(monitorId, {
      now: evaluationDate,
      token: "my-token",
    });

    // Fencing rule: execution was halted because lease expired
    assert.equal(result, null);
    // No missed runs created by stale worker
    assert.equal(missedCreated, false);
    // No updates written to JobMonitor by stale worker
    assert.equal(updateCalled, false);
  } finally {
    JobMonitor.findOne = originalJobMonitorFindOne;
    JobMonitor.updateOne = originalJobMonitorUpdateOne;
    JobRun.findOneAndUpdate = originalJobRunFindOneAndUpdate;
    JobRun.find = originalJobRunFind;
    JobRun.findOne = originalJobRunFindOne;
  }
});
