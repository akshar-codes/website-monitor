import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import JobMonitor from "../src/models/JobMonitor.js";
import JobRun from "../src/models/JobRun.js";
import {
  JOB_SCHEDULE_TYPES,
  JOB_STATUS,
  JOB_RUN_STATUS,
} from "../src/config/constants.js";
import {
  claimNextDueJobMonitor,
  evaluateJobMonitor,
  runClaimedJobMonitor,
  tick,
  start,
  stop,
  metrics,
  resetMetrics,
  inFlightJobMonitorIds,
  activeTasks,
} from "../src/workers/jobMonitorScheduler.js";
import { processHeartbeat } from "../src/services/jobHeartbeat.service.js";

// Ensure test environment variables are loaded
Object.assign(process.env, {
  NODE_ENV: "test",
  MONGO_URI: "mongodb://127.0.0.1:27099/site-watch-tests",
  JOB_SCHEDULER_TICK_MS: "15000",
  JOB_SCHEDULER_LEASE_MS: "30000",
  JOB_SCHEDULER_RETRY_DELAY_MS: "15000",
  JOB_SCHEDULER_CONCURRENCY: "5",
});

beforeEach(() => {
  resetMetrics();
  inFlightJobMonitorIds.clear();
  activeTasks.clear();
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. Distributed Claims and Atomic Lease Management
// ─────────────────────────────────────────────────────────────────────────────

test("Distributed Lease: claimNextDueJobMonitor atomically claims due monitor", async (t) => {
  const monitorId = new mongoose.Types.ObjectId();
  const now = new Date("2026-11-10T12:00:00.000Z");

  const unleasedMonitor = {
    _id: monitorId,
    name: "Nightly Backup",
    active: true,
    status: JOB_STATUS.UP,
    nextEvaluationAt: new Date("2026-11-10T11:59:00.000Z"),
    leaseToken: null,
    leaseUntil: null,
    retryAt: null,
  };

  let capturedQuery = null;
  let capturedUpdate = null;

  t.mock.method(JobMonitor, "findOneAndUpdate", async (query, update, options) => {
    capturedQuery = query;
    capturedUpdate = update;
    return { ...unleasedMonitor };
  });

  const claim = await claimNextDueJobMonitor();

  assert.ok(claim);
  assert.equal(claim.jobMonitor._id, monitorId);
  assert.ok(claim.token);
  assert.equal(capturedQuery.active, true);
  assert.deepEqual(capturedQuery.status, { $ne: JOB_STATUS.PAUSED });
  assert.ok(capturedUpdate.$set.leaseToken);
  assert.ok(capturedUpdate.$set.leaseUntil);
});

test("Distributed Lease: competing worker instances claim a due monitor only once", async (t) => {
  const monitorId = new mongoose.Types.ObjectId();
  let claimed = false;

  t.mock.method(JobMonitor, "findOneAndUpdate", async () => {
    if (claimed) return null;
    claimed = true;
    return {
      _id: monitorId,
      name: "Shared DB Sync",
      active: true,
      status: JOB_STATUS.UP,
    };
  });

  const claims = await Promise.all(
    Array.from({ length: 5 }, () => claimNextDueJobMonitor()),
  );

  const successfulClaims = claims.filter(Boolean);
  assert.equal(successfulClaims.length, 1);
  assert.equal(successfulClaims[0].jobMonitor._id, monitorId);
});

test("Distributed Lease: reclaims expired lease from crashed worker and tracks metric", async (t) => {
  const monitorId = new mongoose.Types.ObjectId();
  const past = new Date(Date.now() - 60000); // Expired 1 min ago

  const expiredLeaseDoc = {
    _id: monitorId,
    name: "Crashed Worker Job",
    active: true,
    leaseToken: "dead-worker-uuid",
    leaseUntil: past,
  };

  t.mock.method(JobMonitor, "findOneAndUpdate", async () => expiredLeaseDoc);

  assert.equal(metrics.leaseExpirationsRecovered, 0);
  const claim = await claimNextDueJobMonitor();

  assert.ok(claim);
  assert.equal(metrics.leaseExpirationsRecovered, 1);
  assert.notEqual(claim.token, "dead-worker-uuid");
});

test("Distributed Lease: ignores paused or inactive monitors during claim", async (t) => {
  let queriedFilter = null;

  t.mock.method(JobMonitor, "findOneAndUpdate", async (filter) => {
    queriedFilter = filter;
    return null;
  });

  await claimNextDueJobMonitor();

  assert.equal(queriedFilter.active, true);
  assert.deepEqual(queriedFilter.status, { $ne: JOB_STATUS.PAUSED });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Execution Timeout Detection & Race Prevention
// ─────────────────────────────────────────────────────────────────────────────

test("Timeout Detection: marks running job as timed_out when exceeding runTimeoutSeconds", async (t) => {
  const monitorId = new mongoose.Types.ObjectId();
  const now = new Date("2026-11-10T12:15:00.000Z");
  const startedAt = new Date("2026-11-10T12:00:00.000Z"); // 15 mins ago

  const monitorDoc = {
    _id: monitorId,
    name: "Heavy Report Worker",
    active: true,
    status: JOB_STATUS.UP,
    scheduleType: JOB_SCHEDULE_TYPES.INTERVAL,
    intervalSeconds: 3600,
    gracePeriodSeconds: 300,
    runTimeoutSeconds: 600, // 10 mins timeout (15 mins > 10 mins -> timed out)
    failureThreshold: 1,
    currentRunId: "run-heavy-1",
    currentRunStartedAt: startedAt,
    nextExpectedAt: new Date("2026-11-10T13:00:00.000Z"),
    consecutiveFailures: 0,
    consecutiveSuccesses: 5,
    toObject() {
      return { ...this };
    },
  };

  let updatedRun = null;
  let monitorUpdatedWith = null;

  t.mock.method(JobMonitor, "findOne", () => ({
    select: async () => monitorDoc,
  }));

  t.mock.method(JobRun, "findOneAndUpdate", async (filter, update) => {
    if (filter.runId === "run-heavy-1" && filter.status === JOB_RUN_STATUS.STARTED) {
      updatedRun = {
        _id: new mongoose.Types.ObjectId(),
        runId: filter.runId,
        status: update.$set.status,
        durationMs: update.$set.durationMs,
        errorMessage: update.$set.errorMessage,
        failureReason: update.$set.failureReason,
      };
      return updatedRun;
    }
    return null;
  });

  t.mock.method(JobRun, "findOne", async () => null);

  t.mock.method(JobMonitor, "updateOne", async (filter, update) => {
    monitorUpdatedWith = update.$set;
    return { modifiedCount: 1 };
  });

  const evaluated = await evaluateJobMonitor(monitorId, { now });

  assert.ok(evaluated);
  assert.equal(metrics.timedOutRuns, 1);
  assert.ok(updatedRun);
  assert.equal(updatedRun.status, JOB_RUN_STATUS.TIMED_OUT);
  assert.equal(updatedRun.failureReason, "execution_timeout");

  assert.equal(monitorUpdatedWith.lastRunStatus, JOB_RUN_STATUS.TIMED_OUT);
  assert.equal(monitorUpdatedWith.status, JOB_STATUS.DOWN);
  assert.equal(monitorUpdatedWith.consecutiveFailures, 1);
  assert.equal(monitorUpdatedWith.consecutiveSuccesses, 0);
  assert.equal(monitorUpdatedWith.currentRunId, null);
  assert.equal(monitorUpdatedWith.currentRunStartedAt, null);
});

test("Timeout Detection: does not time out a run that finished right before evaluation", async (t) => {
  const monitorId = new mongoose.Types.ObjectId();
  const now = new Date("2026-11-10T12:15:00.000Z");

  const monitorDoc = {
    _id: monitorId,
    active: true,
    status: JOB_STATUS.UP,
    scheduleType: JOB_SCHEDULE_TYPES.INTERVAL,
    intervalSeconds: 3600,
    gracePeriodSeconds: 300,
    runTimeoutSeconds: 600,
    currentRunId: "run-concurrent-1",
    currentRunStartedAt: new Date("2026-11-10T12:00:00.000Z"),
    nextExpectedAt: new Date("2026-11-10T13:00:00.000Z"),
    toObject() {
      return { ...this };
    },
  };

  t.mock.method(JobMonitor, "findOne", () => ({
    select: async () => monitorDoc,
  }));

  // Race condition: JobRun was already succeeded by incoming heartbeat
  t.mock.method(JobRun, "findOneAndUpdate", async () => null);
  t.mock.method(JobRun, "findOne", async () => null);
  t.mock.method(JobMonitor, "updateOne", async () => ({ modifiedCount: 1 }));

  await evaluateJobMonitor(monitorId, { now });

  // Should NOT increment timedOutRuns because it was already completed
  assert.equal(metrics.timedOutRuns, 0);
});

test("Late Heartbeat: rejects transition on timed-out run and preserves late execution metadata", async (t) => {
  const monitorId = new mongoose.Types.ObjectId();
  const runId = "run-timed-out-late";
  const startedAt = new Date("2026-11-10T12:00:00.000Z");

  const timedOutRun = {
    _id: new mongoose.Types.ObjectId(),
    jobMonitor: monitorId,
    runId,
    status: JOB_RUN_STATUS.TIMED_OUT,
    startedAt,
    late: false,
    delaySeconds: null,
    save: async function () {
      return this;
    },
  };

  const monitorDoc = {
    _id: monitorId,
    active: true,
    status: JOB_STATUS.DOWN,
  };

  t.mock.method(JobRun, "findOne", async () => timedOutRun);

  // Late worker sends "succeeded" ping after having been timed out
  await assert.rejects(
    processHeartbeat(
      monitorDoc,
      {
        event: "succeeded",
        runId,
        completedAt: new Date("2026-11-10T12:25:00.000Z"), // 25 mins later
        output: "Late backup output",
      },
      {},
    ),
    (err) => {
      assert.equal(err.statusCode, 409);
      assert.match(err.message, /already in terminal state "timed_out"/);
      return true;
    },
  );

  assert.equal(timedOutRun.late, true);
  assert.equal(timedOutRun.delaySeconds, 1500); // 25 mins = 1500s
  assert.equal(timedOutRun.output, "Late backup output");
  // Status remains terminal TIMED_OUT!
  assert.equal(timedOutRun.status, JOB_RUN_STATUS.TIMED_OUT);
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Missed Execution Detection & Deterministic Identifiers
// ─────────────────────────────────────────────────────────────────────────────

test("Missed Execution: creates deterministic missed JobRun after grace period expiry", async (t) => {
  const monitorId = new mongoose.Types.ObjectId();
  const scheduledFor = new Date("2026-11-10T12:00:00.000Z");
  // Grace period 300s (5m) -> deadline 12:05:00
  // Scheduler evaluates at 12:06:00
  const now = new Date("2026-11-10T12:06:00.000Z");

  const monitorDoc = {
    _id: monitorId,
    name: "Sync Invoices",
    active: true,
    status: JOB_STATUS.UP,
    scheduleType: JOB_SCHEDULE_TYPES.INTERVAL,
    intervalSeconds: 3600, // 1 hour
    gracePeriodSeconds: 300,
    failureThreshold: 1,
    nextExpectedAt: scheduledFor,
    consecutiveFailures: 0,
    consecutiveMissed: 0,
    consecutiveSuccesses: 10,
    toObject() {
      return { ...this };
    },
  };

  let createdRun = null;
  let monitorUpdate = null;

  t.mock.method(JobMonitor, "findOne", () => ({
    select: async () => monitorDoc,
  }));

  t.mock.method(JobRun, "findOne", async () => null);

  t.mock.method(JobRun, "create", async (payload) => {
    createdRun = payload;
    return payload;
  });

  t.mock.method(JobMonitor, "updateOne", async (filter, update) => {
    monitorUpdate = update.$set;
    return { modifiedCount: 1 };
  });

  await evaluateJobMonitor(monitorId, { now });

  assert.equal(metrics.missedExecutions, 1);
  assert.ok(createdRun);
  assert.equal(createdRun.status, JOB_RUN_STATUS.MISSED);
  assert.equal(createdRun.scheduledFor.getTime(), scheduledFor.getTime());
  assert.equal(createdRun.occurrenceKey, "2026-11-10T12:00:00.000Z");
  assert.ok(createdRun.runId.startsWith("missed_2026-11-10T12-00-00-000Z_"));

  assert.equal(monitorUpdate.lastRunStatus, JOB_RUN_STATUS.MISSED);
  assert.equal(monitorUpdate.status, JOB_STATUS.DOWN);
  assert.equal(monitorUpdate.consecutiveMissed, 1);
  assert.equal(monitorUpdate.consecutiveFailures, 1);
  assert.equal(monitorUpdate.consecutiveSuccesses, 0);

  // Advanced nextExpectedAt to next hour (13:00)
  assert.equal(
    monitorUpdate.nextExpectedAt.toISOString(),
    "2026-11-10T13:00:00.000Z",
  );
});

test("Missed Execution: does not create missed run if a run already started for occurrence", async (t) => {
  const monitorId = new mongoose.Types.ObjectId();
  const scheduledFor = new Date("2026-11-10T12:00:00.000Z");
  const now = new Date("2026-11-10T12:06:00.000Z");

  const monitorDoc = {
    _id: monitorId,
    active: true,
    status: JOB_STATUS.UP,
    scheduleType: JOB_SCHEDULE_TYPES.INTERVAL,
    intervalSeconds: 3600,
    gracePeriodSeconds: 300,
    nextExpectedAt: scheduledFor,
    toObject() {
      return { ...this };
    },
  };

  t.mock.method(JobMonitor, "findOne", () => ({
    select: async () => monitorDoc,
  }));

  // Qualifying run already exists in database
  t.mock.method(JobRun, "findOne", async () => ({
    _id: new mongoose.Types.ObjectId(),
    occurrenceKey: scheduledFor.toISOString(),
    status: JOB_RUN_STATUS.SUCCEEDED,
  }));

  let createdRun = null;
  t.mock.method(JobRun, "create", async (payload) => {
    createdRun = payload;
    return payload;
  });

  t.mock.method(JobMonitor, "updateOne", async () => ({ modifiedCount: 1 }));

  await evaluateJobMonitor(monitorId, { now });

  assert.equal(createdRun, null);
  assert.equal(metrics.missedExecutions, 0);
});

test("Missed Execution: handles concurrent duplicate creation (code 11000) gracefully", async (t) => {
  const monitorId = new mongoose.Types.ObjectId();
  const scheduledFor = new Date("2026-11-10T12:00:00.000Z");
  const now = new Date("2026-11-10T12:06:00.000Z");

  const monitorDoc = {
    _id: monitorId,
    active: true,
    status: JOB_STATUS.UP,
    scheduleType: JOB_SCHEDULE_TYPES.INTERVAL,
    intervalSeconds: 3600,
    gracePeriodSeconds: 300,
    nextExpectedAt: scheduledFor,
    toObject() {
      return { ...this };
    },
  };

  t.mock.method(JobMonitor, "findOne", () => ({
    select: async () => monitorDoc,
  }));

  t.mock.method(JobRun, "findOne", async () => null);

  // Another instance created it at the same moment -> duplicate key error
  t.mock.method(JobRun, "create", async () => {
    const err = new Error("E11000 duplicate key error");
    err.code = 11000;
    throw err;
  });

  t.mock.method(JobMonitor, "updateOne", async () => ({ modifiedCount: 1 }));

  // Must not throw unhandled exception
  await evaluateJobMonitor(monitorId, { now });
  assert.equal(metrics.missedExecutions, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Scheduler Downtime & Bounded Catch-Up
// ─────────────────────────────────────────────────────────────────────────────

test("Downtime Catch-Up: caps synthetic missed runs at MAX_CATCHUP_RUNS = 5 and advances to future", async (t) => {
  const monitorId = new mongoose.Types.ObjectId();
  // Scheduler was down for 10 hours: interval is 1 hour
  const oldExpected = new Date("2026-11-10T02:00:00.000Z");
  const now = new Date("2026-11-10T12:00:00.000Z");

  const monitorDoc = {
    _id: monitorId,
    name: "Nightly Sync Worker",
    active: true,
    status: JOB_STATUS.UP,
    scheduleType: JOB_SCHEDULE_TYPES.INTERVAL,
    intervalSeconds: 3600, // 1 hour
    gracePeriodSeconds: 300,
    failureThreshold: 10,
    nextExpectedAt: oldExpected,
    consecutiveMissed: 0,
    consecutiveFailures: 0,
    toObject() {
      return { ...this };
    },
  };

  const createdRuns = [];
  let monitorUpdate = null;

  t.mock.method(JobMonitor, "findOne", () => ({
    select: async () => monitorDoc,
  }));

  t.mock.method(JobRun, "findOne", async () => null);

  t.mock.method(JobRun, "create", async (payload) => {
    createdRuns.push(payload);
    return payload;
  });

  t.mock.method(JobMonitor, "updateOne", async (filter, update) => {
    monitorUpdate = update.$set;
    return { modifiedCount: 1 };
  });

  await evaluateJobMonitor(monitorId, { now });

  // Exactly bounded at 5 runs (to prevent DB overload and alert floods)
  assert.equal(createdRuns.length, 5);
  assert.equal(metrics.missedExecutions, 5);
  assert.equal(monitorUpdate.consecutiveMissed, 5);

  // Advances nextExpectedAt to next unexamined occurrence (07:00) and resumes catch-up on subsequent ticks
  assert.equal(
    monitorUpdate.nextExpectedAt.toISOString(),
    "2026-11-10T07:00:00.000Z",
  );
  assert.equal(
    monitorUpdate.nextEvaluationAt.toISOString(),
    now.toISOString(),
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Failure & Recovery Thresholds
// ─────────────────────────────────────────────────────────────────────────────

test("Thresholds: failureThreshold = 2 marks job LATE on first miss, DOWN on second", async (t) => {
  const monitorId = new mongoose.Types.ObjectId();
  const scheduledFor = new Date("2026-11-10T12:00:00.000Z");
  const now = new Date("2026-11-10T12:10:00.000Z");

  // First missed run: consecutiveFailures = 0 -> becomes 1
  const monitorDoc1 = {
    _id: monitorId,
    active: true,
    status: JOB_STATUS.UP,
    scheduleType: JOB_SCHEDULE_TYPES.INTERVAL,
    intervalSeconds: 3600,
    gracePeriodSeconds: 300,
    failureThreshold: 2,
    nextExpectedAt: scheduledFor,
    consecutiveFailures: 0,
    consecutiveMissed: 0,
    toObject() {
      return { ...this };
    },
  };

  let currentDoc = monitorDoc1;
  let latestUpdate = null;

  t.mock.method(JobMonitor, "findOne", () => ({
    select: async () => currentDoc,
  }));
  t.mock.method(JobRun, "findOne", async () => null);
  t.mock.method(JobRun, "create", async (p) => p);
  t.mock.method(JobMonitor, "updateOne", async (f, u) => {
    latestUpdate = u.$set;
    return { modifiedCount: 1 };
  });

  await evaluateJobMonitor(monitorId, { now });

  // 1 failure < 2 threshold -> status is LATE, NOT DOWN!
  assert.equal(latestUpdate.status, JOB_STATUS.LATE);
  assert.equal(latestUpdate.consecutiveFailures, 1);

  // Second missed run: consecutiveFailures = 1 -> becomes 2
  const monitorDoc2 = {
    ...monitorDoc1,
    status: JOB_STATUS.LATE,
    consecutiveFailures: 1,
    consecutiveMissed: 1,
    toObject() {
      return { ...this };
    },
  };
  currentDoc = monitorDoc2;
  const now2 = new Date("2026-11-10T13:10:00.000Z");

  await evaluateJobMonitor(monitorId, { now: now2 });

  // 2 failures >= 2 threshold -> status is DOWN!
  assert.equal(latestUpdate.status, JOB_STATUS.DOWN);
  assert.equal(latestUpdate.consecutiveFailures, 2);
});

test("Thresholds: recoveryThreshold = 2 requires two consecutive successes to restore UP status", async (t) => {
  const monitorId = new mongoose.Types.ObjectId();
  const monitorDoc = {
    _id: monitorId,
    active: true,
    status: JOB_STATUS.DOWN,
    scheduleType: JOB_SCHEDULE_TYPES.INTERVAL,
    intervalSeconds: 3600,
    failureThreshold: 2,
    recoveryThreshold: 2,
    consecutiveFailures: 2,
    consecutiveSuccesses: 0,
    consecutiveMissed: 2,
    currentRunId: null,
    save: async function () {
      return this;
    },
    toObject() {
      return { ...this };
    },
  };

  t.mock.method(JobRun, "findOne", async () => null);
  t.mock.method(JobRun, "create", async (p) => ({ ...p, save: async () => p }));

  // First success: consecutiveSuccesses = 1 (< 2) -> remains DOWN
  await processHeartbeat(
    monitorDoc,
    { event: "succeeded", runId: "recov-run-1" },
    {},
  );
  assert.equal(monitorDoc.consecutiveSuccesses, 1);
  assert.equal(monitorDoc.status, JOB_STATUS.DOWN);

  // Second success: consecutiveSuccesses = 2 (>= 2) -> recovers to UP
  await processHeartbeat(
    monitorDoc,
    { event: "succeeded", runId: "recov-run-2" },
    {},
  );
  assert.equal(monitorDoc.consecutiveSuccesses, 2);
  assert.equal(monitorDoc.status, JOB_STATUS.UP);
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Cron Schedule Advancement with Timezones
// ─────────────────────────────────────────────────────────────────────────────

test("Cron Schedule: correctly evaluates and advances cron schedule across timezones", async (t) => {
  const monitorId = new mongoose.Types.ObjectId();
  // Daily at 02:00 America/New_York
  const oldExpected = new Date("2026-11-10T07:00:00.000Z"); // 02:00 EST is 07:00 UTC
  const now = new Date("2026-11-10T07:10:00.000Z"); // 10 mins past

  const monitorDoc = {
    _id: monitorId,
    name: "NY Daily Ingestion",
    active: true,
    status: JOB_STATUS.UP,
    scheduleType: JOB_SCHEDULE_TYPES.CRON,
    cronExpression: "0 2 * * *",
    timezone: "America/New_York",
    gracePeriodSeconds: 300,
    failureThreshold: 1,
    nextExpectedAt: oldExpected,
    toObject() {
      return { ...this };
    },
  };

  let updatedSet = null;

  t.mock.method(JobMonitor, "findOne", () => ({
    select: async () => monitorDoc,
  }));
  t.mock.method(JobRun, "findOne", async () => null);
  t.mock.method(JobRun, "create", async (p) => p);
  t.mock.method(JobMonitor, "updateOne", async (f, u) => {
    updatedSet = u.$set;
    return { modifiedCount: 1 };
  });

  await evaluateJobMonitor(monitorId, { now });

  assert.equal(metrics.missedExecutions, 1);
  // Next run is tomorrow Nov 11 at 02:00 EST -> 07:00 UTC
  assert.equal(
    updatedSet.nextExpectedAt.toISOString(),
    "2026-11-11T07:00:00.000Z",
  );
  // Next evaluation is expected + grace: 07:05 UTC
  assert.equal(
    updatedSet.nextEvaluationAt.toISOString(),
    "2026-11-11T07:05:00.000Z",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Scheduler Lifecycle, Tick Loop, and Concurrency
// ─────────────────────────────────────────────────────────────────────────────

test("Scheduler Lifecycle: start, tick, and graceful stop drain active tasks cleanly", async (t) => {
  let tickExecuted = false;

  t.mock.method(JobMonitor, "countDocuments", async () => 0);
  t.mock.method(JobMonitor, "findOneAndUpdate", async () => {
    tickExecuted = true;
    return null;
  });

  start();
  // Allow immediate tick to execute
  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.equal(tickExecuted, true);

  await stop();
  assert.equal(activeTasks.size, 0);
  assert.equal(metrics.activeWorkers, 0);
});

test("Scheduler Concurrency: respects bounded concurrency limit during tick", async (t) => {
  let claimAttempts = 0;

  t.mock.method(JobMonitor, "countDocuments", async () => 10);
  t.mock.method(JobMonitor, "findOneAndUpdate", async () => {
    claimAttempts += 1;
    return null;
  });

  await tick();

  // Bounded by env.JOB_SCHEDULER_CONCURRENCY (which was configured to 5)
  assert.ok(claimAttempts <= 5);
});
