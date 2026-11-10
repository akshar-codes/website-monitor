import { test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import {
  JOB_SCHEDULE_TYPES,
  JOB_STATUS,
  JOB_RUN_STATUS,
  PLANS,
} from "../src/config/constants.js";
import { PLAN_DEFINITIONS, getPlanDefinition } from "../src/config/plans.js";
import { FEATURES, hasFeature } from "../src/config/features.js";
import {
  isValidCron,
  isValidTimezone,
  validateScheduleConfig,
  calculateNextRun,
  calculateNextEvaluation,
  recalculateScheduleForUpdate,
  formatScheduleDisplay,
  generateJobToken,
  hashJobToken,
  extractTokenPrefix,
  compareTokenHashes,
  sanitizeRunOutput,
  sanitizeRunMetadata,
} from "../src/services/jobSchedule.service.js";
import JobMonitor from "../src/models/JobMonitor.js";
import JobRun from "../src/models/JobRun.js";
import { getUsageForUser } from "../src/services/usage.service.js";

// ─────────────────────────────────────────────────────────────────────────────
// 1. Cron and Timezone Validation
// ─────────────────────────────────────────────────────────────────────────────

test("Schedule Service: validates standard and extended cron expressions", () => {
  assert.equal(
    isValidCron("0 0 * * *"),
    true,
    "Daily midnight should be valid",
  );
  assert.equal(
    isValidCron("*/15 * * * *"),
    true,
    "Every 15 min should be valid",
  );
  assert.equal(
    isValidCron("0 2 * * 1-5"),
    true,
    "Weekdays at 2am should be valid",
  );
  assert.equal(
    isValidCron("@daily"),
    true,
    "Croner nickname @daily should be valid",
  );
  assert.equal(
    isValidCron("@hourly"),
    true,
    "Croner nickname @hourly should be valid",
  );

  assert.equal(isValidCron(""), false, "Empty string is invalid");
  assert.equal(isValidCron("   "), false, "Whitespace string is invalid");
  assert.equal(isValidCron("not a cron"), false, "Arbitrary text is invalid");
  assert.equal(
    isValidCron("99 99 * * *"),
    false,
    "Out of range cron is invalid",
  );
  assert.equal(isValidCron(null), false, "Null is invalid");
  assert.equal(isValidCron(12345), false, "Non-string is invalid");
});

test("Schedule Service: validates standard IANA timezones using Intl", () => {
  assert.equal(isValidTimezone("UTC"), true);
  assert.equal(isValidTimezone("America/New_York"), true);
  assert.equal(isValidTimezone("Europe/London"), true);
  assert.equal(isValidTimezone("Asia/Kolkata"), true);
  assert.equal(isValidTimezone("Asia/Tokyo"), true);

  assert.equal(isValidTimezone("Mars/Phobos"), false);
  assert.equal(isValidTimezone("Invalid/Tz"), false);
  assert.equal(isValidTimezone(""), false);
  assert.equal(isValidTimezone(null), false);
  assert.equal(isValidTimezone(undefined), false);
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Schedule Configuration Limits & Validation
// ─────────────────────────────────────────────────────────────────────────────

test("Schedule Service: validateScheduleConfig enforces intervals and bounds", () => {
  // Valid interval schedule
  const validInterval = validateScheduleConfig({
    scheduleType: JOB_SCHEDULE_TYPES.INTERVAL,
    intervalSeconds: 300,
    timezone: "UTC",
    gracePeriodSeconds: 60,
    runTimeoutSeconds: 1800,
  });
  assert.equal(validInterval.valid, true);
  assert.equal(validInterval.errors.length, 0);

  // Interval too small (< 10)
  const tooSmall = validateScheduleConfig({
    scheduleType: JOB_SCHEDULE_TYPES.INTERVAL,
    intervalSeconds: 5,
  });
  assert.equal(tooSmall.valid, false);
  assert.match(tooSmall.errors[0], /between 10 and 31536000/);

  // Non-integer interval
  const nonInt = validateScheduleConfig({
    scheduleType: JOB_SCHEDULE_TYPES.INTERVAL,
    intervalSeconds: 60.5,
  });
  assert.equal(nonInt.valid, false);
  assert.match(nonInt.errors[0], /must be an integer/);

  // Grace period out of bounds
  const badGrace = validateScheduleConfig({
    scheduleType: JOB_SCHEDULE_TYPES.INTERVAL,
    intervalSeconds: 60,
    gracePeriodSeconds: 5,
  });
  assert.equal(badGrace.valid, false);
  assert.match(
    badGrace.errors[0],
    /gracePeriodSeconds must be between 10 and 86400/,
  );

  // Run timeout out of bounds
  const badTimeout = validateScheduleConfig({
    scheduleType: JOB_SCHEDULE_TYPES.INTERVAL,
    intervalSeconds: 60,
    runTimeoutSeconds: 5,
  });
  assert.equal(badTimeout.valid, false);
  assert.match(
    badTimeout.errors[0],
    /runTimeoutSeconds must be between 10 and 604800/,
  );

  // Failure and recovery thresholds
  const badThresholds = validateScheduleConfig({
    scheduleType: JOB_SCHEDULE_TYPES.INTERVAL,
    intervalSeconds: 60,
    failureThreshold: 0,
    recoveryThreshold: 15,
  });
  assert.equal(badThresholds.valid, false);
  assert.equal(badThresholds.errors.length, 2);
});

test("Schedule Service: validateScheduleConfig enforces cron requirements", () => {
  // Valid cron
  const validCron = validateScheduleConfig({
    scheduleType: JOB_SCHEDULE_TYPES.CRON,
    cronExpression: "0 4 * * *",
    timezone: "America/New_York",
  });
  assert.equal(validCron.valid, true);

  // Missing cron expression
  const missingExpr = validateScheduleConfig({
    scheduleType: JOB_SCHEDULE_TYPES.CRON,
    cronExpression: null,
  });
  assert.equal(missingExpr.valid, false);
  assert.match(missingExpr.errors[0], /cronExpression is required/);

  // Invalid cron expression
  const invalidExpr = validateScheduleConfig({
    scheduleType: JOB_SCHEDULE_TYPES.CRON,
    cronExpression: "invalid-cron-format",
  });
  assert.equal(invalidExpr.valid, false);
  assert.match(invalidExpr.errors[0], /not a valid cron expression/);

  // Invalid timezone
  const invalidTz = validateScheduleConfig({
    scheduleType: JOB_SCHEDULE_TYPES.CRON,
    cronExpression: "0 0 * * *",
    timezone: "Atlantis/City",
  });
  assert.equal(invalidTz.valid, false);
  assert.match(invalidTz.errors[0], /not a recognized IANA timezone/);
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Next Run & Evaluation Math
// ─────────────────────────────────────────────────────────────────────────────

test("Schedule Service: calculateNextRun computes interval and cron occurrences", () => {
  const base = new Date("2026-11-10T12:00:00.000Z");

  // Interval: 120 seconds
  const nextInterval = calculateNextRun(
    { scheduleType: JOB_SCHEDULE_TYPES.INTERVAL, intervalSeconds: 120 },
    base,
  );
  assert.equal(nextInterval.toISOString(), "2026-11-10T12:02:00.000Z");

  // Cron: daily at 14:00 UTC
  const nextCronUtc = calculateNextRun(
    {
      scheduleType: JOB_SCHEDULE_TYPES.CRON,
      cronExpression: "0 14 * * *",
      timezone: "UTC",
    },
    base,
  );
  assert.equal(nextCronUtc.toISOString(), "2026-11-10T14:00:00.000Z");

  // Cron: daily at 10:00 UTC (after base time, so next day)
  const nextCronPast = calculateNextRun(
    {
      scheduleType: JOB_SCHEDULE_TYPES.CRON,
      cronExpression: "0 10 * * *",
      timezone: "UTC",
    },
    base,
  );
  assert.equal(nextCronPast.toISOString(), "2026-11-11T10:00:00.000Z");
});

test("Schedule Service: handles Daylight Saving Time transitions accurately", () => {
  // Spring Forward: US East jumps 02:00 -> 03:00 on 2026-03-08
  // A cron set for 02:30 AM local time does not exist in local clock time.
  // Croner resolves to the immediate next valid moment in local time (03:00 AM local = 07:00 UTC).
  const springBase = new Date("2026-03-08T05:00:00.000Z"); // 00:00 EST
  const nextSpring = calculateNextRun(
    {
      scheduleType: JOB_SCHEDULE_TYPES.CRON,
      cronExpression: "30 2 * * *",
      timezone: "America/New_York",
    },
    springBase,
  );
  assert.equal(nextSpring.toISOString(), "2026-03-08T07:00:00.000Z");

  // Fall Back: US East repeats 01:00 -> 02:00 on 2026-11-01
  // A cron set for 01:30 AM local time evaluates deterministically.
  const fallBase = new Date("2026-11-01T04:00:00.000Z");
  const nextFall = calculateNextRun(
    {
      scheduleType: JOB_SCHEDULE_TYPES.CRON,
      cronExpression: "30 1 * * *",
      timezone: "America/New_York",
    },
    fallBase,
  );
  assert.equal(nextFall.toISOString(), "2026-11-01T05:30:00.000Z");
});

test("Schedule Service: calculateNextEvaluation computes evaluation deadlines", () => {
  const now = new Date("2026-11-10T12:00:00.000Z");
  const nextExpected = new Date("2026-11-10T13:00:00.000Z");

  // Case 1: Job waiting for next scheduled run -> evaluate at expected + grace
  const evalIdle = calculateNextEvaluation(
    {
      gracePeriodSeconds: 300,
      runTimeoutSeconds: 3600,
      currentRunStartedAt: null,
      nextExpectedAt: nextExpected,
    },
    now,
  );
  assert.equal(evalIdle.toISOString(), "2026-11-10T13:05:00.000Z");

  // Case 2: Job currently running -> evaluate at started + timeout + grace
  const startedAt = new Date("2026-11-10T12:10:00.000Z");
  const evalRunning = calculateNextEvaluation(
    {
      gracePeriodSeconds: 120,
      runTimeoutSeconds: 600, // 10 minutes timeout
      currentRunStartedAt: startedAt,
      nextExpectedAt: null,
    },
    now,
  );
  // startedAt + (600 + 120)s = 12:10 + 12m = 12:22:00 UTC
  assert.equal(evalRunning.toISOString(), "2026-11-10T12:22:00.000Z");
});

test("Schedule Service: recalculateScheduleForUpdate updates milestones without rewriting history", () => {
  const existingJob = {
    scheduleType: JOB_SCHEDULE_TYPES.INTERVAL,
    intervalSeconds: 3600,
    cronExpression: null,
    timezone: "UTC",
    gracePeriodSeconds: 300,
    runTimeoutSeconds: 3600,
    currentRunStartedAt: null,
    nextExpectedAt: new Date("2026-11-10T11:00:00.000Z"), // in the past
  };

  const now = new Date("2026-11-10T12:00:00.000Z");

  // Update from 1-hour interval to 15-minute interval
  const updated = recalculateScheduleForUpdate(
    existingJob,
    { intervalSeconds: 900 },
    now,
  );

  assert.equal(updated.intervalSeconds, 900);
  assert.equal(
    updated.nextExpectedAt.toISOString(),
    "2026-11-10T12:15:00.000Z",
  );
  assert.equal(
    updated.nextEvaluationAt.toISOString(),
    "2026-11-10T12:20:00.000Z",
  );

  // Update scheduleType to cron
  const updatedCron = recalculateScheduleForUpdate(
    existingJob,
    {
      scheduleType: JOB_SCHEDULE_TYPES.CRON,
      cronExpression: "0 18 * * *",
      timezone: "America/New_York",
    },
    now,
  );
  assert.equal(updatedCron.scheduleType, JOB_SCHEDULE_TYPES.CRON);
  assert.equal(updatedCron.cronExpression, "0 18 * * *");
  // 18:00 EST on 2026-11-10 is 23:00 UTC
  assert.equal(
    updatedCron.nextExpectedAt.toISOString(),
    "2026-11-10T23:00:00.000Z",
  );
});

test("Schedule Service: formatScheduleDisplay formats user-friendly copy", () => {
  assert.equal(
    formatScheduleDisplay({
      scheduleType: JOB_SCHEDULE_TYPES.INTERVAL,
      intervalSeconds: 60,
    }),
    "Every minute",
  );
  assert.equal(
    formatScheduleDisplay({
      scheduleType: JOB_SCHEDULE_TYPES.INTERVAL,
      intervalSeconds: 300,
    }),
    "Every 5 minutes",
  );
  assert.equal(
    formatScheduleDisplay({
      scheduleType: JOB_SCHEDULE_TYPES.INTERVAL,
      intervalSeconds: 3600,
    }),
    "Every hour",
  );
  assert.equal(
    formatScheduleDisplay({
      scheduleType: JOB_SCHEDULE_TYPES.INTERVAL,
      intervalSeconds: 86400,
    }),
    "Every day",
  );
  assert.equal(
    formatScheduleDisplay({
      scheduleType: JOB_SCHEDULE_TYPES.CRON,
      cronExpression: "0 0 * * *",
      timezone: "UTC",
    }),
    'Cron "0 0 * * *"',
  );
  assert.equal(
    formatScheduleDisplay({
      scheduleType: JOB_SCHEDULE_TYPES.CRON,
      cronExpression: "0 0 * * *",
      timezone: "America/New_York",
    }),
    'Cron "0 0 * * *" (America/New_York)',
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Token Security, Hashing & Sanitization
// ─────────────────────────────────────────────────────────────────────────────

test("Schedule Service: token generation, hashing and timing-safe comparison", () => {
  const { token, prefix, tokenHash } = generateJobToken();

  assert.match(token, /^jm_live_[a-f0-9]{12}_[A-Za-z0-9_-]+$/);
  assert.match(prefix, /^jm_live_[a-f0-9]{12}$/);
  assert.equal(extractTokenPrefix(token), prefix);
  assert.equal(tokenHash.length, 64);

  // Deterministic hashing
  assert.equal(hashJobToken(token), tokenHash);

  // Timing safe comparison
  assert.equal(compareTokenHashes(tokenHash, tokenHash), true);
  assert.equal(compareTokenHashes(tokenHash, "0".repeat(64)), false);
  assert.equal(compareTokenHashes(tokenHash, "short"), false);
});

test("Schedule Service: output and metadata sanitization", () => {
  // Output truncation and null byte stripping
  const rawOutput = "log line 1\0\nlog line 2\n" + "x".repeat(6000);
  const cleanOutput = sanitizeRunOutput(rawOutput, 5000);
  assert.equal(cleanOutput.includes("\0"), false);
  assert.equal(cleanOutput.length, 5000);
  assert.equal(sanitizeRunOutput(null), null);

  // Metadata bounding
  const bigMetadata = { nested: { sub: "ok" } };
  for (let i = 0; i < 30; i++) {
    bigMetadata[`key_${i}`] = `value_${i}`;
  }
  const cleanMetadata = sanitizeRunMetadata(bigMetadata, 20);
  assert.equal(Object.keys(cleanMetadata).length, 20);
  assert.equal(cleanMetadata.nested.sub, "ok");
  assert.equal(sanitizeRunMetadata(null), null);
  assert.equal(sanitizeRunMetadata("string"), null);
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. JobMonitor Model Schema & Virtuals
// ─────────────────────────────────────────────────────────────────────────────

test("JobMonitor Model: validation, defaults and virtuals", async () => {
  const ownerId = new mongoose.Types.ObjectId();

  const monitor = new JobMonitor({
    owner: ownerId,
    name: "Nightly Backup",
    scheduleType: JOB_SCHEDULE_TYPES.INTERVAL,
    intervalSeconds: 3600,
  });

  // Pre-validate hook auto-generates token
  await monitor.validate();
  assert.ok(monitor.tokenPrefix.startsWith("jm_live_"));
  assert.ok(monitor.tokenHash);
  assert.equal(monitor.gracePeriodSeconds, 300);
  assert.equal(monitor.runTimeoutSeconds, 3600);
  assert.equal(monitor.status, JOB_STATUS.PENDING);
  assert.equal(monitor.active, true);

  // Virtuals
  assert.equal(monitor.scheduleDisplay, "Every hour");
  assert.equal(monitor.isRunning, false);
  assert.equal(monitor.isHealthy, false);

  // Overdue calculation
  monitor.nextExpectedAt = new Date(Date.now() - 400 * 1000); // 400s ago (> 300s grace)
  assert.equal(monitor.isOverdue, true);

  monitor.nextExpectedAt = new Date(Date.now() + 60 * 1000); // 60s in future
  assert.equal(monitor.isOverdue, false);

  // toJSON strips sensitive credentials
  const json = monitor.toJSON();
  assert.equal(json.id, String(monitor._id));
  assert.equal(json.tokenHash, undefined);
  assert.equal(json.previousTokenHash, undefined);
  assert.equal(json.leaseToken, undefined);
  assert.equal(json.leaseUntil, undefined);
  assert.equal(json.retryAt, undefined);
});

test("JobMonitor Model: rejects invalid schedule configuration in validation", async () => {
  const ownerId = new mongoose.Types.ObjectId();

  // Missing interval for interval type
  const badInterval = new JobMonitor({
    owner: ownerId,
    name: "Bad Interval",
    scheduleType: JOB_SCHEDULE_TYPES.INTERVAL,
    intervalSeconds: null,
  });
  await assert.rejects(
    () => badInterval.validate(),
    (err) => Boolean(err.errors.intervalSeconds),
  );

  // Invalid cron for cron type
  const badCron = new JobMonitor({
    owner: ownerId,
    name: "Bad Cron",
    scheduleType: JOB_SCHEDULE_TYPES.CRON,
    cronExpression: "invalid-cron",
  });
  await assert.rejects(
    () => badCron.validate(),
    (err) => Boolean(err.errors.cronExpression),
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. JobRun Model Schema & Virtuals
// ─────────────────────────────────────────────────────────────────────────────

test("JobRun Model: validation, virtuals and pre-save duration hook", async () => {
  const jobMonitorId = new mongoose.Types.ObjectId();
  const startedAt = new Date("2026-11-10T10:00:00.000Z");
  const completedAt = new Date("2026-11-10T10:02:30.000Z"); // 150 seconds

  const run = new JobRun({
    jobMonitor: jobMonitorId,
    runId: "run-uuid-12345",
    occurrenceKey: "2026-11-10T10:00:00.000Z",
    status: JOB_RUN_STATUS.SUCCEEDED,
    startedAt,
    completedAt,
    output: "Dump successful",
    metadata: { env: "production", version: "1.2.0" },
  });

  await run.validate();

  assert.equal(run.durationMs, 150_000);
  assert.equal(run.durationSeconds, 150);
  assert.equal(run.isFinished, true);
  assert.ok(run.receivedAt instanceof Date);

  // toJSON strips _id and __v
  const json = run.toJSON();
  assert.equal(json.id, String(run._id));
  assert.equal(json._id, undefined);
  assert.equal(json.__v, undefined);
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Subscription Plans & Entitlements Integration
// ─────────────────────────────────────────────────────────────────────────────

test("Subscription Plans: Centralized Job Monitoring limits across tiers", () => {
  const free = getPlanDefinition(PLANS.FREE);
  assert.equal(free.limits.maxJobMonitors, 2);
  assert.equal(free.limits.minJobIntervalSeconds, 300);
  assert.equal(free.limits.jobRetentionDays, 7);

  const pro = getPlanDefinition(PLANS.PRO);
  assert.equal(pro.limits.maxJobMonitors, 15);
  assert.equal(pro.limits.minJobIntervalSeconds, 60);
  assert.equal(pro.limits.jobRetentionDays, 30);

  const unlimited = getPlanDefinition(PLANS.UNLIMITED);
  assert.equal(unlimited.limits.maxJobMonitors, null);
  assert.equal(unlimited.limits.minJobIntervalSeconds, 10);
  assert.equal(unlimited.limits.jobRetentionDays, 365);
});

test("Subscription Features: Gating via hasFeature(plan, FEATURES.JOB_MONITORING)", () => {
  assert.equal(hasFeature(PLANS.FREE, FEATURES.JOB_MONITORING), true);
  assert.equal(hasFeature(PLANS.PRO, FEATURES.JOB_MONITORING), true);
  assert.equal(hasFeature(PLANS.UNLIMITED, FEATURES.JOB_MONITORING), true);
});
