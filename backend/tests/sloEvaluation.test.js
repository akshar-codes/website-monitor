import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import express from "express";
import mongoose from "mongoose";
import Slo from "../src/models/Slo.js";
import Monitor from "../src/models/Monitor.js";
import HealthCheck from "../src/models/HealthCheck.js";
import User from "../src/models/User.js";
import SloSnapshot from "../src/models/SloSnapshot.js";
import Activity from "../src/models/Activity.js";
import StatusPage from "../src/models/StatusPage.js";
import {
  calculateSliFromChecks,
  CALCULATION_VERSION,
} from "../src/services/sliCalculator.js";
import {
  evaluateSlo,
  getSloSnapshots,
  getLatestSloSnapshot,
} from "../src/services/sloEvaluation.service.js";
import { claimNextDueSlo } from "../src/workers/sloScheduler.js";
import { ROLES } from "../src/config/constants.js";

// Test setup
Object.assign(process.env, {
  NODE_ENV: "test",
  MONGO_URI: "mongodb://127.0.0.1:27099/site-watch-tests",
  COOKIE_SECRET: "test-cookie-secret-with-more-than-thirty-two-characters",
  SESSION_SECRET: "test-session-secret-with-more-than-thirty-two-characters",
  SLO_EVALUATION_LEASE_MS: "60000",
  SLO_EVALUATION_RETRY_DELAY_MS: "30000",
});

const userAId = "64b000000000000000000010";
const userBId = "64b000000000000000000020";
const monitorAId = "64b000000000000000000030";
const monitorBId = "64b000000000000000000040";
const sloAId = "64b000000000000000000050";

let server;
let baseUrl;

before(async () => {
  const [{ default: routes }, { default: errorHandler }] = await Promise.all([
    import("../src/routes/index.js"),
    import("../src/middlewares/errorHandler.js"),
  ]);

  Activity.create = async () => ({});

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const role = req.get("x-test-role");
    req.isAuthenticated = () => Boolean(role);
    if (role) {
      const id = req.get("x-test-user-id") || userAId;
      req.user = {
        id,
        _id: id,
        role,
        active: true,
        plan: "pro",
        planStatus: "active",
      };
    }
    next();
  });

  app.use("/api", routes);
  app.use(errorHandler);

  server = app.listen(0);
  server.unref();
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) {
    server.closeAllConnections?.();
    await new Promise((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  }
  for (const h of process._getActiveHandles()) {
    if (h.unref) h.unref();
  }
});

const request = (
  path,
  { role = ROLES.USER, userId = userAId, method = "GET", body } = {},
) =>
  fetch(`${baseUrl}/api${path}`, {
    method,
    headers: {
      ...(role ? { "x-test-role": role } : {}),
      ...(userId ? { "x-test-user-id": userId } : {}),
      ...(body ? { "content-type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

// ─────────────────────────────────────────────────────────────────────────────
// Mathematical Unit Tests (Verified against Hand-Calculated Fixtures)
// ─────────────────────────────────────────────────────────────────────────────

test("SLI Math: Perfect Availability (100% SLI, 0 consumed, 100% remaining)", async () => {
  const windowEnd = new Date("2026-11-09T12:00:00.000Z");
  const durationSeconds = 7 * 86400; // 604,800 seconds (7 days)
  const windowStart = new Date(windowEnd.getTime() - durationSeconds * 1000);

  // Generate continuous UP checks every 300s
  const checks = [];
  for (
    let t = windowStart.getTime() + 300000;
    t <= windowEnd.getTime();
    t += 300000
  ) {
    checks.push({
      status: "up",
      checkedAt: new Date(t),
      intervalSeconds: 300,
      scheduled: true,
    });
  }

  const result = await calculateSliFromChecks(checks, {
    targetPercentage: 99.0,
    rollingWindow: "7d",
    windowEnd,
    monitorInterval: 300,
    minimumDataCoveragePercent: 95.0,
  });

  assert.equal(result.calculationVersion, CALCULATION_VERSION);
  assert.equal(result.totalWindowSeconds, 604800);
  assert.equal(result.effectiveWindowSeconds, 604800);
  assert.equal(result.badDurationSeconds, 0);
  assert.equal(result.sliPercentage, 100.0);
  assert.ok(result.coveragePercentage >= 95.0);
  // Allowed budget: (1 - 0.99) * 604,800 = 6,048 seconds
  assert.equal(result.allowedBudgetSeconds, 6048);
  assert.equal(result.consumedBudgetSeconds, 0);
  assert.equal(result.remainingBudgetSeconds, 6048);
  assert.equal(result.remainingBudgetPercentage, 100.0);
  assert.equal(result.budgetConsumptionPercentage, 0.0);
  assert.equal(result.status, "healthy");
});

test("SLI Math: Exact Target Match (SLI equals target, 0 remaining budget)", async () => {
  const windowEnd = new Date("2026-11-09T12:00:00.000Z");
  const windowDurationMs = 7 * 86400000;
  const windowStart = new Date(windowEnd.getTime() - windowDurationMs);

  // Total eligible: 604,800 seconds. Target 99.0% -> allowed downtime is exactly 6,048 seconds.
  const checks = [];
  const downDuration = 6048;
  const upDuration = 604800 - downDuration;

  let currentMs = windowStart.getTime();

  // First: up checks
  while (currentMs < windowStart.getTime() + upDuration * 1000) {
    currentMs += 300000;
    checks.push({
      status: "up",
      checkedAt: new Date(
        Math.min(currentMs, windowStart.getTime() + upDuration * 1000),
      ),
      intervalSeconds: 300,
    });
  }

  // Then: down checks filling exactly 6,048 seconds
  let downAcc = 0;
  while (downAcc < downDuration) {
    const step = Math.min(300, downDuration - downAcc);
    currentMs += step * 1000;
    downAcc += step;
    checks.push({
      status: "down",
      checkedAt: new Date(currentMs),
      intervalSeconds: step,
    });
  }

  const result = await calculateSliFromChecks(checks, {
    targetPercentage: 99.0,
    rollingWindow: "7d",
    windowEnd,
    monitorInterval: 300,
    budgetWarningThresholdPercent: 0,
  });

  // SLI is exactly 99.0%
  assert.equal(Math.round(result.sliPercentage * 10) / 10, 99.0);
  assert.equal(result.allowedBudgetSeconds, 6048);
  assert.equal(result.consumedBudgetSeconds, 6048);
  assert.equal(result.remainingBudgetSeconds, 0);
  assert.equal(result.budgetConsumptionPercentage, 100.0);
  assert.equal(result.remainingBudgetPercentage, 0.0);
  assert.equal(result.status, "warning");
});

test("SLI Math: Target Breach with Negative Remaining Budget and Over-consumption", async () => {
  const windowEnd = new Date("2026-11-09T12:00:00.000Z");
  const windowDurationMs = 7 * 86400000;
  const windowStart = new Date(windowEnd.getTime() - windowDurationMs);

  // Total window: 604,800s. Allowed budget at 99.0% is 6,048s.
  // Bad duration is 14,800 seconds (breaches the 6,048s budget by 8,752s).
  const badDuration = 14800;
  const goodDuration = 604800 - badDuration;

  const checks = [
    {
      status: "up",
      checkedAt: new Date(windowStart.getTime() + goodDuration * 1000),
      intervalSeconds: goodDuration,
    },
    {
      status: "down",
      checkedAt: new Date(windowEnd.getTime()),
      intervalSeconds: badDuration,
    },
  ];

  const result = await calculateSliFromChecks(checks, {
    targetPercentage: 99.0,
    rollingWindow: "7d",
    windowEnd,
    monitorInterval: 300,
    maxIntervalAttributionSeconds: 604800,
  });

  assert.equal(result.allowedBudgetSeconds, 6048);
  assert.equal(result.consumedBudgetSeconds, 14800);
  // Remaining budget must be NEGATIVE!
  assert.equal(result.remainingBudgetSeconds, 6048 - 14800); // -8752
  assert.ok(result.remainingBudgetSeconds < 0);

  // Budget consumption percentage > 100%
  const expectedConsumption = Number(((14800 / 6048) * 100).toFixed(2));
  assert.equal(result.budgetConsumptionPercentage, expectedConsumption);
  assert.ok(result.budgetConsumptionPercentage > 100);

  // Remaining budget percentage is NEGATIVE!
  assert.ok(result.remainingBudgetPercentage < 0);
  assert.equal(result.status, "breached");
  assert.ok(result.sliPercentage < 99.0);
});

test("SLI Math: Sparse Observations, Gaps & Maximum Attribution Ceiling", async () => {
  const windowEnd = new Date("2026-11-09T12:00:00.000Z");
  const windowStart = new Date(windowEnd.getTime() - 24 * 3600 * 1000); // 24h window (86,400s)

  // Two checks separated by 10 hours (36,000s)
  // Ceiling is 3600s
  const check1Time = new Date(windowStart.getTime() + 3600000);
  const check2Time = new Date(check1Time.getTime() + 10 * 3600 * 1000); // 10h gap

  const checks = [
    { status: "up", checkedAt: check1Time, intervalSeconds: 300 },
    { status: "down", checkedAt: check2Time, intervalSeconds: 300 },
  ];

  const result = await calculateSliFromChecks(checks, {
    targetPercentage: 99.9,
    rollingWindow: "24h",
    windowEnd,
    monitorInterval: 300,
    maxIntervalAttributionSeconds: 3600, // Ceiling 1 hour
    minimumDataCoveragePercent: 95.0,
  });

  // Gap was 36,000 seconds. Check 2 can only claim 3,600s max.
  // The unobserved gap is categorized as unknown duration!
  assert.ok(result.unknownDurationSeconds >= 32400);
  assert.equal(result.badDurationSeconds, 3600);

  // Unknown duration is never counted as success
  assert.notEqual(result.goodDurationSeconds, 86400);

  // Data coverage should fall far below 95%
  assert.ok(result.coveragePercentage < 95.0);
  assert.equal(result.status, "insufficient_data");
});

test("SLI Math: Maintenance Window Exclusion Policy", async () => {
  const windowEnd = new Date("2026-11-09T12:00:00.000Z");
  const windowStart = new Date(windowEnd.getTime() - 24 * 3600 * 1000); // 86,400s

  const maintStart = new Date(windowStart.getTime() + 2 * 3600 * 1000);
  const maintEnd = new Date(windowStart.getTime() + 4 * 3600 * 1000); // 2 hours maintenance (7200s)

  const checks = [
    {
      status: "up",
      checkedAt: new Date(maintStart.getTime() - 1000), // before maintenance
      intervalSeconds: 7200,
    },
    // Failing checks inside sanctioned maintenance
    {
      status: "down",
      checkedAt: new Date(maintStart.getTime() + 3600 * 1000),
      intervalSeconds: 3600,
    },
    {
      status: "down",
      checkedAt: maintEnd,
      intervalSeconds: 3600,
    },
    // Up checks outside maintenance
    {
      status: "up",
      checkedAt: windowEnd,
      intervalSeconds: 86400 - 14400,
    },
  ];

  const result = await calculateSliFromChecks(checks, {
    targetPercentage: 99.0,
    rollingWindow: "24h",
    windowEnd,
    monitorInterval: 300,
    maxIntervalAttributionSeconds: 86400,
    excludeMaintenance: true,
    maintenanceWindows: [
      { scheduledStart: maintStart, scheduledEnd: maintEnd },
    ],
  });

  // Maintenance duration accounted
  assert.ok(result.maintenanceDurationSeconds >= 7200);

  // Bad checks inside maintenance did NOT count as bad duration
  assert.equal(result.badDurationSeconds, 0);
  assert.equal(result.consumedBudgetSeconds, 0);

  // Eligible window reduced by maintenance duration: 86,400 - 7,200 = 79,200s
  assert.equal(
    result.eligibleWindowSeconds,
    86400 - result.maintenanceDurationSeconds,
  );
  assert.equal(result.sliPercentage, 100.0);
  assert.equal(result.status, "healthy");
});

test("SLI Math: Incomplete History & Monitor Age Boundary Clamping", async () => {
  const windowEnd = new Date("2026-11-09T12:00:00.000Z");
  // Monitor was created 2 days ago, but requested rolling window is 30 days
  const monitorCreatedAt = new Date(windowEnd.getTime() - 2 * 86400 * 1000); // 172,800s
  const downSeconds = 1728;

  const checks = [
    {
      status: "up",
      checkedAt: new Date(windowEnd.getTime() - downSeconds * 1000),
      intervalSeconds: 172800 - downSeconds,
    },
    {
      status: "down",
      checkedAt: windowEnd,
      intervalSeconds: downSeconds, // exactly 1% downtime of the 2-day existence
    },
  ];

  const result = await calculateSliFromChecks(checks, {
    targetPercentage: 99.0,
    rollingWindow: "30d",
    windowEnd,
    monitorCreatedAt,
    monitorInterval: 300,
    maxIntervalAttributionSeconds: 200000,
    budgetWarningThresholdPercent: 0,
  });

  // Total window nominal is 30 days, but effective window is clamped to 2 days (172,800s)
  assert.equal(result.totalWindowSeconds, 30 * 86400);
  assert.equal(result.effectiveWindowSeconds, 172800);
  assert.equal(result.metadata.isClampedByCreation, true);

  // Allowed budget is calculated over effective window: 0.01 * 172,800 = 1,728 seconds
  assert.equal(result.allowedBudgetSeconds, 1728);
  assert.equal(result.consumedBudgetSeconds, 1728);
  assert.equal(result.remainingBudgetSeconds, 0);
  assert.equal(result.budgetConsumptionPercentage, 100.0);
});

test("SLI Math: Multi-Window Scaling (7d vs 30d comparison)", async () => {
  const windowEnd = new Date("2026-11-09T12:00:00.000Z");
  const badSeconds = 3600; // 1 hour of downtime in recent 7 days

  const makeChecks = (windowDurationSeconds) => [
    {
      status: "up",
      checkedAt: new Date(windowEnd.getTime() - badSeconds * 1000),
      intervalSeconds: windowDurationSeconds - badSeconds,
    },
    {
      status: "down",
      checkedAt: windowEnd,
      intervalSeconds: badSeconds,
    },
  ];

  const result7d = await calculateSliFromChecks(makeChecks(7 * 86400), {
    targetPercentage: 99.5,
    rollingWindow: "7d",
    windowEnd,
    maxIntervalAttributionSeconds: 30 * 86400,
  });

  const result30d = await calculateSliFromChecks(makeChecks(30 * 86400), {
    targetPercentage: 99.5,
    rollingWindow: "30d",
    windowEnd,
    maxIntervalAttributionSeconds: 30 * 86400,
  });

  // Over 7 days: (604800 - 3600) / 604800 = 99.4048% -> breaches 99.5%
  assert.ok(result7d.sliPercentage < 99.5);
  assert.equal(result7d.status, "breached");

  // Over 30 days: (2592000 - 3600) / 2592000 = 99.8611% -> healthy for 99.5%
  assert.ok(result30d.sliPercentage > 99.5);
  assert.equal(result30d.status, "healthy");
});

// ─────────────────────────────────────────────────────────────────────────────
// Integration Tests: Snapshot Persistence, Idempotency, Scheduler & REST APIs
// ─────────────────────────────────────────────────────────────────────────────

test("SLO Evaluation Service: Persists snapshot idempotently and updates SLO document", async (t) => {
  const mockSlo = {
    _id: sloAId,
    owner: userAId,
    monitor: monitorAId,
    name: "Production SLO",
    targetPercentage: 99.9,
    rollingWindow: "30d",
    evaluationInterval: "1h",
    evaluationIntervalSeconds: 3600,
    measurementContract: {
      maxIntervalAttributionSeconds: 3600,
      minimumDataCoveragePercent: 95.0,
      excludeMaintenance: true,
      countDegradedAsDown: true,
    },
    alertSettings: {
      budgetWarningThresholdPercent: 20,
    },
    save: async function () {
      return this;
    },
  };

  const mockMonitor = {
    _id: monitorAId,
    owner: userAId,
    name: "Production API",
    interval: 300,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  };

  mockSlo.populate = async () => mockSlo;
  t.mock.method(Slo, "findById", (id) => mockSlo);
  t.mock.method(Monitor, "findById", async () => mockMonitor);
  t.mock.method(User, "findById", () => ({
    select() {
      return this;
    },
    lean: async () => ({ plan: "pro" }),
  }));
  t.mock.method(StatusPage, "find", () => ({
    select() {
      return this;
    },
    lean: async () => [],
  }));
  t.mock.method(HealthCheck, "find", () => ({
    select() {
      return this;
    },
    sort() {
      return this;
    },
    lean() {
      return this;
    },
    cursor() {
      return (async function* () {
        yield {
          status: "up",
          checkedAt: new Date(),
          intervalSeconds: 300,
        };
      })();
    },
  }));

  const inMemorySnapshots = new Map();
  t.mock.method(SloSnapshot, "create", async (data) => {
    const id = "64b000000000000000000099";
    const doc = { _id: id, ...data };
    if (inMemorySnapshots.has(data.idempotencyKey)) {
      const err = new Error("Duplicate key");
      err.code = 11000;
      throw err;
    }
    inMemorySnapshots.set(data.idempotencyKey, doc);
    return doc;
  });

  t.mock.method(SloSnapshot, "findOne", async (query) => {
    return inMemorySnapshots.get(query.idempotencyKey) || null;
  });

  const now = new Date("2026-11-09T18:00:00.000Z");

  // First evaluation: creates snapshot
  const eval1 = await evaluateSlo(sloAId, { now, persistSnapshot: true });
  assert.ok(eval1.snapshot);
  assert.equal(eval1.snapshot.calculationVersion, CALCULATION_VERSION);
  assert.equal(inMemorySnapshots.size, 1);
  assert.equal(mockSlo.lastEvaluatedAt.toISOString(), now.toISOString());

  // Second evaluation at the exact same timestamp: hits idempotency key without crashing
  const eval2 = await evaluateSlo(sloAId, { now, persistSnapshot: true });
  assert.ok(eval2.snapshot);
  assert.equal(inMemorySnapshots.size, 1); // No duplicate snapshot created!
});

test("SLO Background Scheduler: Atomic claim, lease management and concurrency protection", async (t) => {
  let claimedDoc = null;

  t.mock.method(Slo, "findOneAndUpdate", async (query, update) => {
    if (claimedDoc) {
      // Already leased by another worker!
      return null;
    }
    claimedDoc = {
      _id: sloAId,
      name: "API SLO",
      evaluationLeaseToken: update.$set.evaluationLeaseToken,
      evaluationLeaseUntil: update.$set.evaluationLeaseUntil,
    };
    return claimedDoc;
  });

  // 1. First worker claims the due SLO
  const claim1 = await claimNextDueSlo();
  assert.ok(claim1);
  assert.equal(claim1.slo._id, sloAId);
  assert.ok(claim1.token);

  // 2. Competing worker tries to claim the same SLO -> blocked by active lease
  const claim2 = await claimNextDueSlo();
  assert.equal(claim2, null);
});

test("SLO API: /api/slos/:id/evaluate, /snapshots and /latest endpoints", async (t) => {
  const mockSlo = {
    _id: sloAId,
    owner: userAId,
    monitor: monitorAId,
    name: "Gateway SLO",
    targetPercentage: 99.9,
    rollingWindow: "30d",
    evaluationInterval: "1h",
    evaluationIntervalSeconds: 3600,
    save: async function () {
      return this;
    },
  };

  const mockMonitor = {
    _id: monitorAId,
    owner: userAId,
    interval: 300,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  };

  mockSlo.populate = async () => mockSlo;
  t.mock.method(Slo, "findById", (id) => mockSlo);
  t.mock.method(Monitor, "findById", async () => mockMonitor);
  t.mock.method(User, "findById", () => ({
    select() {
      return this;
    },
    lean: async () => ({ plan: "pro" }),
  }));
  t.mock.method(StatusPage, "find", () => ({
    select() {
      return this;
    },
    lean: async () => [],
  }));
  t.mock.method(HealthCheck, "find", () => ({
    select() {
      return this;
    },
    sort() {
      return this;
    },
    lean() {
      return this;
    },
    cursor() {
      return (async function* () {
        yield {
          status: "up",
          checkedAt: new Date(),
          intervalSeconds: 300,
        };
      })();
    },
  }));

  const mockSnapshot = {
    _id: "64b000000000000000000077",
    slo: sloAId,
    monitor: monitorAId,
    owner: userAId,
    sliPercentage: 99.95,
    status: "healthy",
    evaluatedAt: new Date(),
  };

  t.mock.method(SloSnapshot, "create", async () => mockSnapshot);
  t.mock.method(SloSnapshot, "findOne", () => ({
    sort() {
      return this;
    },
    lean: async () => mockSnapshot,
  }));
  t.mock.method(SloSnapshot, "find", () => ({
    sort() {
      return this;
    },
    skip() {
      return this;
    },
    limit() {
      return this;
    },
    lean: async () => [mockSnapshot],
  }));
  t.mock.method(SloSnapshot, "countDocuments", async () => 1);

  // 1. POST /api/slos/:id/evaluate
  const evalRes = await request(`/slos/${sloAId}/evaluate`, {
    method: "POST",
  });
  assert.equal(evalRes.status, 200);
  const evalData = await evalRes.json();
  assert.equal(evalData.success, true);
  assert.equal(evalData.data._id, mockSnapshot._id);

  // 2. GET /api/slos/:id/latest
  const latestRes = await request(`/slos/${sloAId}/latest`);
  assert.equal(latestRes.status, 200);
  const latestData = await latestRes.json();
  assert.equal(latestData.data._id, mockSnapshot._id);
  assert.equal(latestData.data.status, "healthy");

  // 3. GET /api/slos/:id/snapshots
  const snapRes = await request(`/slos/${sloAId}/snapshots?page=1&limit=10`);
  assert.equal(snapRes.status, 200);
  const snapData = await snapRes.json();
  assert.equal(snapData.success, true);
  assert.equal(snapData.data.length, 1);
  assert.equal(snapData.pagination.total, 1);

  // 4. Cross-tenant access: User B denied access to User A's evaluation
  const foreignRes = await request(`/slos/${sloAId}/evaluate`, {
    method: "POST",
    userId: userBId,
  });
  assert.equal(foreignRes.status, 403);
});
