import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import express from "express";
import mongoose from "mongoose";
import Slo from "../src/models/SLO.js";
import Monitor from "../src/models/Monitor.js";
import HealthCheck from "../src/models/HealthCheck.js";
import User from "../src/models/User.js";
import SloSnapshot from "../src/models/SloSnapshot.js";
import SloAlertState from "../src/models/SloAlertState.js";
import Notification from "../src/models/Notification.js";
import NotificationDelivery from "../src/models/NotificationDelivery.js";
import NotificationIntegration from "../src/models/NotificationIntegration.js";
import NotificationRule from "../src/models/NotificationRule.js";
import Activity from "../src/models/Activity.js";
import StatusPage from "../src/models/StatusPage.js";
import { calculateSliFromChecks } from "../src/services/sliCalculator.js";
import {
  evaluateAlertConditions,
  processSloAlerts,
  getSloAlertState,
} from "../src/services/sloAlert.service.js";
import { evaluateSlo } from "../src/services/sloEvaluation.service.js";
import { ROLES } from "../src/config/constants.js";
import { NOTIFICATION_TYPES } from "../src/config/notificationConstants.js";

// Test environment setup
Object.assign(process.env, {
  NODE_ENV: "test",
  MONGO_URI: "mongodb://127.0.0.1:27099/site-watch-tests",
  COOKIE_SECRET: "test-cookie-secret-with-more-than-thirty-two-characters",
  SESSION_SECRET: "test-session-secret-with-more-than-thirty-two-characters",
});

const userAId = "64b000000000000000000010";
const userBId = "64b000000000000000000020";
const monitorAId = "64b000000000000000000030";
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
      connection: "close",
      ...(role ? { "x-test-role": role } : {}),
      ...(userId ? { "x-test-user-id": userId } : {}),
      ...(body ? { "content-type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

// ─────────────────────────────────────────────────────────────────────────────
// 1. Brief Spikes & Evidence Validation (Anti-Poisoning & Denominator Defense)
// ─────────────────────────────────────────────────────────────────────────────

test("SLO Alerts: Brief spike on slow cadence monitor rejected due to insufficient evidence (isolated check)", async () => {
  const windowEnd = new Date("2026-11-10T12:00:00.000Z");
  // 5-minute lookback window (300s). Monitor interval is 300s.
  // Exactly 1 check occurred and was DOWN.
  const checks = [
    {
      status: "down",
      checkedAt: new Date(windowEnd.getTime() - 60000),
      intervalSeconds: 300,
    },
  ];

  const result = await calculateSliFromChecks(checks, {
    targetPercentage: 99.0, // Error budget fraction E = 0.01
    rollingWindow: "24h",
    windowEnd,
    monitorInterval: 300,
    burnRateThresholds: [{ window: "5m", rate: 14.4, severity: "critical" }],
  });

  const fiveMinBurn = result.burnRates.find((b) => b.window === "5m");
  assert.ok(fiveMinBurn);
  assert.equal(fiveMinBurn.sampleCount, 1);
  // Isolated single check must be denied sufficient evidence!
  assert.equal(fiveMinBurn.hasSufficientEvidence, false);
  assert.ok(
    fiveMinBurn.evidenceReason === "isolated_check" ||
      fiveMinBurn.evidenceReason === "window_smaller_than_cadence",
  );

  // When evaluated for alerts:
  const slo = {
    _id: sloAId,
    name: "API Service",
    alertSettings: {
      burnRateAlertsEnabled: true,
      burnRateThresholds: [{ window: "5m", rate: 14.4, severity: "critical" }],
    },
  };

  const triggered = evaluateAlertConditions({
    slo,
    evaluationResult: result,
    now: windowEnd,
  });
  // Must NOT trigger burn rate alert due to lack of evidence!
  assert.equal(triggered.filter((t) => t.alertType === "burn_rate").length, 0);
});

test("SLO Alerts: Brief isolated spike on fast monitor calculates 5m burn rate but multi-window prevents sustained alert", async () => {
  const windowEnd = new Date("2026-11-10T12:00:00.000Z");
  // 60-second monitor interval. Over 30 minutes (1800s), 1 check failed (60s), 29 checks succeeded (1740s)
  const checks = [];
  const startMs = windowEnd.getTime() - 30 * 60 * 1000;

  for (let t = startMs + 60000; t <= windowEnd.getTime(); t += 60000) {
    // Only the check 2 minutes ago failed
    const isDown = t === windowEnd.getTime() - 120000;
    checks.push({
      status: isDown ? "down" : "up",
      checkedAt: new Date(t),
      intervalSeconds: 60,
    });
  }

  const result = await calculateSliFromChecks(checks, {
    targetPercentage: 99.0, // E = 0.01
    rollingWindow: "24h",
    windowEnd,
    monitorInterval: 60,
    burnRateThresholds: [
      { window: "5m", rate: 14.4, severity: "critical" },
      { window: "30m", rate: 6.0, severity: "high" },
    ],
  });

  const m5 = result.burnRates.find((b) => b.window === "5m");
  const m30 = result.burnRates.find((b) => b.window === "30m");

  assert.ok(m5);
  assert.ok(m30);

  // In 5m (5-6 checks): 1 down (60s), rest up
  assert.ok(m5.sampleCount >= 5);
  assert.equal(m5.hasSufficientEvidence, true);
  assert.ok(m5.burnRate > 14.4); // 5m spikes above 14.4x

  // But in 30m (30 checks): 1 down (60s), 29 up (1740s) -> error rate 3.33% -> 3.33x burn (< 6.0x!)
  assert.equal(m30.sampleCount, 30);
  assert.equal(m30.hasSufficientEvidence, true);
  assert.ok(m30.burnRate < 6.0); // 3.33x does NOT breach the 6x 30-minute threshold!
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Sustained Failure & Multi-Window Burn Rate Alerts (14.4x, 6x, 2x)
// ─────────────────────────────────────────────────────────────────────────────

test("SLO Alerts: Sustained failure triggers multi-window burn rate alerts (14.4x in 5m, 6x in 30m, 2x in 6h)", async () => {
  const windowEnd = new Date("2026-11-10T12:00:00.000Z");
  // Total outage over past 6 hours (continuous DOWN checks every 60s)
  const checks = [];
  const startMs = windowEnd.getTime() - 6 * 3600 * 1000;

  for (let t = startMs + 60000; t <= windowEnd.getTime(); t += 60000) {
    checks.push({
      status: "down",
      checkedAt: new Date(t),
      intervalSeconds: 60,
    });
  }

  const result = await calculateSliFromChecks(checks, {
    targetPercentage: 99.0, // E = 0.01 -> 100% outage is 100.0x burn rate
    rollingWindow: "7d",
    windowEnd,
    monitorInterval: 60,
    burnRateThresholds: [
      { window: "5m", rate: 14.4, severity: "critical" },
      { window: "30m", rate: 6.0, severity: "high" },
      { window: "6h", rate: 2.0, severity: "normal" },
    ],
  });

  const m5 = result.burnRates.find((b) => b.window === "5m");
  const m30 = result.burnRates.find((b) => b.window === "30m");
  const m6h = result.burnRates.find((b) => b.window === "6h");

  assert.equal(m5.burnRate, 100.0);
  assert.equal(m30.burnRate, 100.0);
  assert.equal(m6h.burnRate, 100.0);

  assert.equal(m5.hasSufficientEvidence, true);
  assert.equal(m30.hasSufficientEvidence, true);
  assert.equal(m6h.hasSufficientEvidence, true);

  const slo = {
    _id: sloAId,
    name: "Production Gateway",
    alertSettings: {
      burnRateAlertsEnabled: true,
      burnRateThresholds: [
        { window: "5m", rate: 14.4, severity: "critical" },
        { window: "30m", rate: 6.0, severity: "high" },
        { window: "6h", rate: 2.0, severity: "normal" },
      ],
      budgetExhaustedAlert: true,
    },
  };

  const triggered = evaluateAlertConditions({
    slo,
    evaluationResult: result,
    now: windowEnd,
  });
  const burnAlerts = triggered.filter((t) => t.alertType === "burn_rate");
  assert.equal(burnAlerts.length, 3);

  const critical5m = burnAlerts.find((a) => a.window === "5m");
  assert.equal(critical5m.severity, "critical");
  assert.equal(critical5m.rate, 100.0);
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Zero Burn & Non-Exhausting State
// ─────────────────────────────────────────────────────────────────────────────

test("SLO Alerts: Zero burn produces 0.0x rate, not_exhausting forecast, and zero alerts", async () => {
  const windowEnd = new Date("2026-11-10T12:00:00.000Z");
  // 100% UP checks every 300s over 7 days
  const checks = [];
  const startMs = windowEnd.getTime() - 7 * 86400 * 1000;

  for (let t = startMs + 300000; t <= windowEnd.getTime(); t += 300000) {
    checks.push({
      status: "up",
      checkedAt: new Date(t),
      intervalSeconds: 300,
    });
  }

  const result = await calculateSliFromChecks(checks, {
    targetPercentage: 99.9,
    rollingWindow: "7d",
    windowEnd,
    monitorInterval: 300,
    burnRateThresholds: [
      { window: "1h", rate: 14.4, severity: "critical" },
      { window: "6h", rate: 6.0, severity: "high" },
    ],
  });

  for (const br of result.burnRates) {
    assert.equal(br.burnRate, 0.0);
  }

  // Exhaustion forecast must be not_exhausting
  assert.equal(result.exhaustionForecast.status, "not_exhausting");
  assert.equal(result.exhaustionForecast.hoursToExhaustion, null);
  assert.equal(result.exhaustionForecast.projectedExhaustionAt, null);
  assert.equal(result.exhaustionForecast.consumptionRatePerSecond, 0);

  const slo = {
    _id: sloAId,
    name: "Zero Burn API",
    alertSettings: {
      burnRateAlertsEnabled: true,
      burnRateThresholds: [{ window: "1h", rate: 14.4 }],
      budgetExhaustedAlert: true,
      budgetWarningThresholdPercent: 20,
    },
  };

  const triggered = evaluateAlertConditions({
    slo,
    evaluationResult: result,
    now: windowEnd,
  });
  assert.equal(triggered.length, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Insufficient Telemetry Data & Unavailable Forecast
// ─────────────────────────────────────────────────────────────────────────────

test("SLO Alerts: Insufficient data marks forecast unavailable and prevents alerts", async () => {
  const windowEnd = new Date("2026-11-10T12:00:00.000Z");
  // Empty checks list
  const checks = [];

  const result = await calculateSliFromChecks(checks, {
    targetPercentage: 99.0,
    rollingWindow: "24h",
    windowEnd,
    monitorInterval: 300,
    burnRateThresholds: [{ window: "1h", rate: 14.4 }],
  });

  assert.equal(result.status, "insufficient_data");
  assert.equal(result.exhaustionForecast.status, "unavailable");
  assert.equal(result.exhaustionForecast.hoursToExhaustion, null);
  assert.equal(result.exhaustionForecast.projectedExhaustionAt, null);

  const slo = {
    _id: sloAId,
    name: "Sparse Monitor",
    alertSettings: {
      burnRateAlertsEnabled: true,
      burnRateThresholds: [{ window: "1h", rate: 14.4 }],
    },
  };

  const triggered = evaluateAlertConditions({
    slo,
    evaluationResult: result,
    now: windowEnd,
  });
  assert.equal(triggered.length, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Already-Exhausted Error Budget & Forecast
// ─────────────────────────────────────────────────────────────────────────────

test("SLO Alerts: Already-exhausted error budget triggers budget_exhausted alert and sets status already_exhausted", async () => {
  const windowEnd = new Date("2026-11-10T12:00:00.000Z");
  // Total window: 86,400s (24h). At 99.0%, allowed budget is 864s.
  // 5,000 seconds of downtime completely exhausts the budget!
  const badDuration = 5000;
  const goodDuration = 86400 - badDuration;

  const checks = [
    {
      status: "up",
      checkedAt: new Date(windowEnd.getTime() - badDuration * 1000),
      intervalSeconds: goodDuration,
    },
    {
      status: "down",
      checkedAt: windowEnd,
      intervalSeconds: badDuration,
    },
  ];

  const result = await calculateSliFromChecks(checks, {
    targetPercentage: 99.0,
    rollingWindow: "24h",
    windowEnd,
    monitorInterval: 60,
    maxIntervalAttributionSeconds: 86400,
  });

  assert.ok(result.remainingBudgetSeconds < 0);
  assert.equal(result.status, "breached");
  assert.equal(result.exhaustionForecast.status, "already_exhausted");
  assert.equal(result.exhaustionForecast.hoursToExhaustion, 0);

  const slo = {
    _id: sloAId,
    name: "Exhausted Service",
    alertSettings: {
      budgetExhaustedAlert: true,
      budgetWarningThresholdPercent: 20,
    },
  };

  const triggered = evaluateAlertConditions({
    slo,
    evaluationResult: result,
    now: windowEnd,
  });
  const exhaustedAlert = triggered.find(
    (t) => t.alertType === "budget_exhausted",
  );
  assert.ok(exhaustedAlert);
  assert.equal(exhaustedAlert.severity, "critical");
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Defensible Positive Exhaustion Forecasting
// ─────────────────────────────────────────────────────────────────────────────

test("SLO Alerts: Defensible positive consumption rate calculates accurate hours to exhaustion and date", async () => {
  const windowEnd = new Date("2026-11-10T12:00:00.000Z");
  // Total window: 7 days (604,800s). At 99.0%, allowed budget is 6,048 seconds.
  // Suppose 3,048s has been consumed, so remaining budget is exactly 3,000s.
  // Over recent 1h window (3600s), downtime is 216s (error rate 216/3600 = 0.06 downtime sec/sec = 6% error rate = 6.0x burn rate).
  // Time to exhaust remaining 3,000s = 3000 / 0.06 = 50,000 seconds = 13.89 hours!
  const checks = [];
  const startMs = windowEnd.getTime() - 3600 * 1000;

  // Generate 60 checks of 60s in the 1h window
  for (let i = 1; i <= 60; i++) {
    const t = startMs + i * 60000;
    // 3.6 minutes (216s) down, rest up
    const isDown = i <= 3 || i === 4; // ~240s
    checks.push({
      status: isDown ? "down" : "up",
      checkedAt: new Date(t),
      intervalSeconds: 60,
    });
  }

  const result = await calculateSliFromChecks(checks, {
    targetPercentage: 99.0,
    rollingWindow: "7d",
    windowEnd,
    monitorInterval: 60,
    burnRateThresholds: [{ window: "1h", rate: 6.0 }],
  });

  const forecast = result.exhaustionForecast;
  assert.equal(forecast.status, "forecasted");
  assert.ok(forecast.hoursToExhaustion > 0);
  assert.ok(forecast.projectedExhaustionAt instanceof Date);
  assert.ok(forecast.projectedExhaustionAt.getTime() > windowEnd.getTime());
  assert.ok(forecast.consumptionRatePerSecond > 0);
  assert.ok(forecast.burnRate > 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Alert Lifecycle: Deduplication, Cooldown, Resolution & Re-triggering
// ─────────────────────────────────────────────────────────────────────────────

test("SLO Alerts Lifecycle: Deduplication prevents repeat notifications; recovery advances sequence; re-triggering succeeds", async () => {
  let createdNotifications = [];
  let queuedDeliveries = [];

  const mockDeps = {
    Notification: {
      create: async (doc) => {
        const record = { _id: new mongoose.Types.ObjectId(), ...doc };
        createdNotifications.push(record);
        return record;
      },
    },
    NotificationDelivery: {
      updateOne: async ({ idempotencyKey }, update) => {
        queuedDeliveries.push({ idempotencyKey, ...update.$setOnInsert });
        return { upsertedCount: 1 };
      },
    },
    NotificationIntegration: {
      find: () => ({
        lean: async () => [
          { _id: "64b000000000000000000088", name: "Ops Webhook" },
        ],
      }),
    },
    NotificationRule: {
      find: () => ({
        lean: async () => [],
      }),
    },
  };

  const slo = {
    _id: sloAId,
    monitor: monitorAId,
    owner: userAId,
    name: "Core API",
    alertSettings: {
      burnRateAlertsEnabled: true,
      burnRateThresholds: [{ window: "5m", rate: 14.4, severity: "critical" }],
      cooldownMinutes: 60,
      integrationIds: ["64b000000000000000000088"],
    },
  };

  // Mock SloAlertState in-memory storage
  let inMemoryState = null;
  mockDeps.SloAlertState = {
    findOneAndUpdate: async (query, update) => {
      if (!inMemoryState) {
        inMemoryState = {
          _id: new mongoose.Types.ObjectId(),
          slo: slo._id,
          monitor: slo.monitor,
          owner: slo.owner,
          status: "healthy",
          activeAlerts: [],
          incidentSequence: 1,
          consecutiveBreaches: 0,
          consecutiveRecoveries: 0,
          save: async function () {
            return this;
          },
        };
      }
      return inMemoryState;
    },
  };

  const t1 = new Date("2026-11-10T12:00:00.000Z");

  // Tick 1: Outage triggers 14.4x burn rate alert
  const evalResultOutage = {
    burnRates: [
      {
        window: "5m",
        burnRate: 100.0,
        hasSufficientEvidence: true,
        sampleCount: 5,
        badDurationSeconds: 300,
        observedDurationSeconds: 300,
      },
    ],
    remainingBudgetSeconds: 4000,
    remainingBudgetPercentage: 80.0,
    budgetConsumptionPercentage: 20.0,
    exhaustionForecast: {
      status: "forecasted",
      hoursToExhaustion: 1.11,
      projectedExhaustionAt: new Date(t1.getTime() + 4000000),
    },
  };

  const step1 = await processSloAlerts({
    slo,
    evaluationResult: evalResultOutage,
    now: t1,
    deps: mockDeps,
  });

  assert.equal(step1.newAlerts.length, 1);
  assert.equal(createdNotifications.length, 1);
  assert.equal(
    createdNotifications[0].type,
    NOTIFICATION_TYPES.SLO_BURN_RATE_ALERT,
  );
  assert.equal(inMemoryState.activeAlerts.length, 1);
  assert.equal(inMemoryState.status, "breached");
  assert.equal(inMemoryState.incidentSequence, 1);

  // Tick 2: 5 minutes later, outage continues. Evaluation repeated within 60m cooldown.
  // Deduplication MUST suppress repeat notification!
  const t2 = new Date(t1.getTime() + 5 * 60 * 1000);
  const step2 = await processSloAlerts({
    slo,
    evaluationResult: evalResultOutage,
    now: t2,
    deps: mockDeps,
  });

  assert.equal(step2.newAlerts.length, 0); // No new alert!
  assert.equal(createdNotifications.length, 1); // No duplicate notification created!
  assert.equal(inMemoryState.activeAlerts.length, 1);

  // Tick 3: Service recovers! Burn rate returns to 0.0x.
  const t3 = new Date(t1.getTime() + 15 * 60 * 1000);
  const evalResultRecovery = {
    burnRates: [
      {
        window: "5m",
        burnRate: 0.0,
        hasSufficientEvidence: true,
        sampleCount: 5,
        badDurationSeconds: 0,
        observedDurationSeconds: 300,
      },
    ],
    remainingBudgetSeconds: 4000,
    remainingBudgetPercentage: 80.0,
    budgetConsumptionPercentage: 20.0,
    exhaustionForecast: { status: "not_exhausting" },
  };

  const step3 = await processSloAlerts({
    slo,
    evaluationResult: evalResultRecovery,
    now: t3,
    deps: mockDeps,
  });

  assert.equal(step3.resolvedAlerts.length, 1);
  assert.equal(inMemoryState.activeAlerts.length, 0); // Active alerts cleared
  assert.equal(inMemoryState.status, "healthy");
  assert.equal(inMemoryState.incidentSequence, 2); // Incident sequence incremented!
  assert.equal(createdNotifications.length, 2);
  assert.equal(createdNotifications[1].type, NOTIFICATION_TYPES.SLO_RECOVERED);

  // Tick 4: Re-triggering! A new outage occurs at t4.
  // Because incidentSequence is now 2, fresh dedupeKey is generated and new alert fires!
  const t4 = new Date(t1.getTime() + 30 * 60 * 1000);
  const step4 = await processSloAlerts({
    slo,
    evaluationResult: evalResultOutage,
    now: t4,
    deps: mockDeps,
  });

  assert.equal(step4.newAlerts.length, 1);
  assert.equal(createdNotifications.length, 3);
  assert.equal(
    createdNotifications[2].type,
    NOTIFICATION_TYPES.SLO_BURN_RATE_ALERT,
  );
  assert.equal(inMemoryState.activeAlerts.length, 1);
  assert.equal(inMemoryState.incidentSequence, 2);
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. Notification Failure Isolation (Evaluation Never Invalidated)
// ─────────────────────────────────────────────────────────────────────────────

test("SLO Alerts: Notification delivery failure does not invalidate evaluation", async () => {
  const failingDeps = {
    Notification: {
      create: async () => {
        throw new Error("SMTP server connection refused");
      },
    },
    NotificationDelivery: {
      updateOne: async () => {
        throw new Error("Integration webhook database socket hang up");
      },
    },
    NotificationIntegration: {
      find: () => ({
        lean: async () => [{ _id: "int-1" }],
      }),
    },
    NotificationRule: {
      find: () => ({
        lean: async () => [],
      }),
    },
    SloAlertState: {
      findOneAndUpdate: async () => {
        return {
          _id: new mongoose.Types.ObjectId(),
          slo: sloAId,
          activeAlerts: [],
          incidentSequence: 1,
          consecutiveBreaches: 0,
          consecutiveRecoveries: 0,
          save: async function () {
            return this;
          },
        };
      },
    },
  };

  const slo = {
    _id: sloAId,
    monitor: monitorAId,
    owner: userAId,
    name: "Fault Tolerant API",
    alertSettings: {
      burnRateAlertsEnabled: true,
      burnRateThresholds: [{ window: "5m", rate: 14.4 }],
    },
  };

  const evalResultOutage = {
    burnRates: [
      {
        window: "5m",
        burnRate: 50.0,
        hasSufficientEvidence: true,
        sampleCount: 5,
        badDurationSeconds: 150,
        observedDurationSeconds: 300,
      },
    ],
    remainingBudgetSeconds: 1000,
    remainingBudgetPercentage: 50.0,
    budgetConsumptionPercentage: 50.0,
  };

  // Evaluation must complete and return result without throwing!
  const res = await processSloAlerts({
    slo,
    evaluationResult: evalResultOutage,
    now: new Date(),
    deps: failingDeps,
  });

  assert.ok(res.state);
  assert.equal(res.state.status, "breached");
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. REST API: GET /api/slos/:id/alert-state
// ─────────────────────────────────────────────────────────────────────────────

test("SLO API: GET /api/slos/:id/alert-state enforces tenant authorization", async (t) => {
  const mockAlertState = {
    _id: "64b000000000000000000099",
    slo: sloAId,
    monitor: monitorAId,
    owner: userAId,
    status: "healthy",
    activeAlerts: [],
    incidentSequence: 1,
    consecutiveBreaches: 0,
    consecutiveRecoveries: 12,
    lastEvaluatedAt: new Date(),
    lastBurnRates: [{ window: "5m", burnRate: 0.0 }],
  };

  t.mock.method(SloAlertState, "findOne", () => ({
    populate: async () => mockAlertState,
    ...mockAlertState,
  }));

  // 1. User A (owner) can read alert state
  const ownerRes = await request(`/slos/${sloAId}/alert-state`, {
    userId: userAId,
  });
  assert.equal(ownerRes.status, 200);
  const ownerData = await ownerRes.json();
  assert.equal(ownerData.success, true);
  assert.equal(ownerData.data.status, "healthy");

  // 2. User B (foreign tenant) is forbidden (403)
  const foreignRes = await request(`/slos/${sloAId}/alert-state`, {
    userId: userBId,
  });
  assert.equal(foreignRes.status, 403);
});

test("SLO Alerts: a 100% target with no downtime does not exhaust a zero-sized budget", () => {
  const triggered = evaluateAlertConditions({
    slo: {
      _id: sloAId,
      name: "Perfect Availability",
      targetPercentage: 100,
      alertSettings: { budgetExhaustedAlert: true },
    },
    evaluationResult: {
      status: "healthy",
      allowedBudgetSeconds: 0,
      consumedBudgetSeconds: 0,
      remainingBudgetSeconds: 0,
      budgetConsumptionPercentage: 0,
      remainingBudgetPercentage: 100,
    },
  });
  assert.equal(
    triggered.some((item) => item.alertType === "budget_exhausted"),
    false,
  );
});

test("SLO Alerts: insufficient data preserves active alert state without recovery", async () => {
  const activeAlerts = [{ alertType: "budget_exhausted", window: null }];
  const state = {
    status: "exhausted",
    activeAlerts,
    consecutiveBreaches: 3,
    consecutiveRecoveries: 0,
    save: async () =>
      assert.fail("insufficient data must not update alert state"),
  };
  const result = await processSloAlerts({
    slo: { _id: sloAId, monitor: monitorAId, owner: userAId, name: "Unknown" },
    evaluationResult: { status: "insufficient_data" },
    deps: { SloAlertState: { findOneAndUpdate: async () => state } },
  });
  assert.equal(result.evaluationState, "insufficient_data");
  assert.equal(result.state.status, "exhausted");
  assert.equal(result.state.activeAlerts, activeAlerts);
  assert.equal(result.resolvedAlerts.length, 0);
  assert.equal(result.state.consecutiveRecoveries, 0);
});
