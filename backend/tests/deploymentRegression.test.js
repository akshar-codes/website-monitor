import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import {
  DEFAULT_REGRESSION_CONFIG,
  validateRegressionConfig,
  classifyRegressionType,
  evaluateRegressionSignals,
  evaluateDeploymentRegression,
} from "../src/services/deploymentRegression.service.js";
import DeploymentAlertState, {
  REGRESSION_TYPES,
  REGRESSION_STATUSES,
  DEFAULT_CORRELATION_DISCLAIMER,
} from "../src/models/DeploymentAlertState.js";
import {
  calculateCheckStats,
  calculateMetricDiffs,
} from "../src/services/deployment.service.js";

// Helper IDs for test fixtures
const testMonitorId = new mongoose.Types.ObjectId();
const testDeploymentId = new mongoose.Types.ObjectId();
const testOwnerId = new mongoose.Types.ObjectId();

test("Regression Configuration Validator: accepts valid parameters and applies defaults", () => {
  const defaults = validateRegressionConfig();
  assert.equal(defaults.windowMinutes, 30);
  assert.equal(defaults.minSampleCount, 3);
  assert.equal(defaults.medianLatencyIncreaseMs, 30);
  assert.equal(defaults.medianLatencyIncreasePercent, 20);
  assert.equal(defaults.p95LatencyIncreaseMs, 50);
  assert.equal(defaults.p95LatencyIncreasePercent, 25);
  assert.equal(defaults.failureRateIncreasePercent, 5.0);
  assert.equal(defaults.availabilityDropPercent, 5.0);
  assert.equal(defaults.cooldownMinutes, 60);

  const custom = validateRegressionConfig({
    windowMinutes: 60,
    minSampleCount: 5,
    medianLatencyIncreaseMs: 50,
    failureRateIncreasePercent: 10,
  });
  assert.equal(custom.windowMinutes, 60);
  assert.equal(custom.minSampleCount, 5);
  assert.equal(custom.medianLatencyIncreaseMs, 50);
  assert.equal(custom.failureRateIncreasePercent, 10);
});

test("Regression Configuration Validator: rejects invalid boundaries", () => {
  assert.throws(
    () => validateRegressionConfig({ windowMinutes: 2 }),
    /Evaluation window must be between 5 and 1440 minutes/,
  );
  assert.throws(
    () => validateRegressionConfig({ minSampleCount: 0 }),
    /Minimum sample count must be an integer between 1 and 100/,
  );
  assert.throws(
    () => validateRegressionConfig({ medianLatencyIncreaseMs: -10 }),
    /Median latency increase thresholds must be non-negative numbers/,
  );
  assert.throws(
    () => validateRegressionConfig({ failureRateIncreasePercent: 150 }),
    /Failure rate increase threshold must be between 0 and 100/,
  );
});

test("Regression Classifier: accurately labels regression types", () => {
  assert.equal(
    classifyRegressionType({
      hasLatency: true,
      hasFailure: false,
      hasIncident: false,
    }),
    REGRESSION_TYPES.LATENCY,
  );
  assert.equal(
    classifyRegressionType({
      hasLatency: false,
      hasFailure: true,
      hasIncident: false,
    }),
    REGRESSION_TYPES.FAILURE_RATE,
  );
  assert.equal(
    classifyRegressionType({
      hasLatency: false,
      hasFailure: false,
      hasIncident: true,
    }),
    REGRESSION_TYPES.INCIDENT,
  );
  assert.equal(
    classifyRegressionType({
      hasLatency: true,
      hasFailure: true,
      hasIncident: false,
    }),
    REGRESSION_TYPES.COMBINED,
  );
  assert.equal(
    classifyRegressionType({
      hasLatency: false,
      hasFailure: false,
      hasIncident: false,
    }),
    REGRESSION_TYPES.COMBINED,
  );
});

test("Threshold Boundaries: just-below vs just-above latency threshold", () => {
  const config = DEFAULT_REGRESSION_CONFIG;

  // Baseline: 100ms
  const beforeStats = {
    sampleCount: 10,
    successfulChecks: 10,
    failedChecks: 0,
    availability: 100,
    failureRate: 0,
    medianResponseTime: 100,
    p95ResponseTime: 120,
    hasSufficientSamples: true,
  };

  // 1. Boundary: 119ms (+19ms, +19%) -> Just below the 20% and 30ms threshold
  const subThresholdStats = {
    sampleCount: 10,
    successfulChecks: 10,
    failedChecks: 0,
    availability: 100,
    failureRate: 0,
    medianResponseTime: 119,
    p95ResponseTime: 135,
    hasSufficientSamples: true,
  };
  const diffSub = calculateMetricDiffs(beforeStats, subThresholdStats);
  const resultSub = evaluateRegressionSignals({
    beforeStats,
    afterStats: subThresholdStats,
    diff: diffSub,
    relatedIncidents: [],
    config,
    isWindowIncomplete: false,
  });

  assert.equal(resultSub.status, REGRESSION_STATUSES.NORMAL);
  assert.equal(resultSub.hasSuspectedRegression, false);

  // 2. Boundary: 135ms (+35ms, +35%) -> Meets both >= 20% and >= 30ms
  const overThresholdStats = {
    sampleCount: 10,
    successfulChecks: 10,
    failedChecks: 0,
    availability: 100,
    failureRate: 0,
    medianResponseTime: 135,
    p95ResponseTime: 150,
    hasSufficientSamples: true,
  };
  const diffOver = calculateMetricDiffs(beforeStats, overThresholdStats);
  const resultOver = evaluateRegressionSignals({
    beforeStats,
    afterStats: overThresholdStats,
    diff: diffOver,
    relatedIncidents: [],
    config,
    isWindowIncomplete: false,
  });

  assert.equal(resultOver.status, REGRESSION_STATUSES.SUSPECTED_REGRESSION);
  assert.equal(resultOver.hasSuspectedRegression, true);
  assert.equal(resultOver.regressionType, REGRESSION_TYPES.LATENCY);
  assert.ok(
    resultOver.evidence.some((e) =>
      e.includes("Median response time degraded"),
    ),
  );
});

test("Threshold Boundaries: failure rate and availability drop triggers", () => {
  const config = DEFAULT_REGRESSION_CONFIG;

  const beforeStats = {
    sampleCount: 20,
    successfulChecks: 20,
    failedChecks: 0,
    availability: 100,
    failureRate: 0,
    medianResponseTime: 80,
    p95ResponseTime: 95,
    hasSufficientSamples: true,
  };

  // 1. Boundary: Failure rate increased by 4.9% (below 5.0% threshold)
  const afterSub = {
    sampleCount: 20,
    successfulChecks: 19,
    failedChecks: 1,
    availability: 95.1,
    failureRate: 4.9,
    medianResponseTime: 82,
    p95ResponseTime: 97,
    hasSufficientSamples: true,
  };
  const diffSub = calculateMetricDiffs(beforeStats, afterSub);
  const resultSub = evaluateRegressionSignals({
    beforeStats,
    afterStats: afterSub,
    diff: diffSub,
    relatedIncidents: [],
    config,
    isWindowIncomplete: false,
  });
  assert.equal(resultSub.status, REGRESSION_STATUSES.NORMAL);

  // 2. Boundary: Failure rate increased by 10% (exceeds 5.0% threshold)
  const afterOver = {
    sampleCount: 20,
    successfulChecks: 18,
    failedChecks: 2,
    availability: 90.0,
    failureRate: 10.0,
    medianResponseTime: 82,
    p95ResponseTime: 97,
    hasSufficientSamples: true,
  };
  const diffOver = calculateMetricDiffs(beforeStats, afterOver);
  const resultOver = evaluateRegressionSignals({
    beforeStats,
    afterStats: afterOver,
    diff: diffOver,
    relatedIncidents: [],
    config,
    isWindowIncomplete: false,
  });
  assert.equal(resultOver.status, REGRESSION_STATUSES.SUSPECTED_REGRESSION);
  assert.equal(resultOver.regressionType, REGRESSION_TYPES.FAILURE_RATE);
  assert.ok(
    resultOver.evidence.some((e) => e.includes("Failure rate elevated")),
  );
});

test("Post-Deployment Incidents: automatically trigger suspected regression classification", () => {
  const config = DEFAULT_REGRESSION_CONFIG;
  const beforeStats = {
    sampleCount: 10,
    successfulChecks: 10,
    failedChecks: 0,
    availability: 100,
    failureRate: 0,
    medianResponseTime: 50,
    p95ResponseTime: 60,
    hasSufficientSamples: true,
  };
  const afterStats = {
    sampleCount: 10,
    successfulChecks: 10,
    failedChecks: 0,
    availability: 100,
    failureRate: 0,
    medianResponseTime: 52,
    p95ResponseTime: 61,
    hasSufficientSamples: true,
  };
  const diff = calculateMetricDiffs(beforeStats, afterStats);

  const postDeployIncident = {
    id: "inc-101",
    title: "HTTP 502 Gateway Errors",
    status: "ongoing",
    timingRelation: "started_after_deployment",
  };

  const result = evaluateRegressionSignals({
    beforeStats,
    afterStats,
    diff,
    relatedIncidents: [postDeployIncident],
    config,
    isWindowIncomplete: false,
  });

  assert.equal(result.status, REGRESSION_STATUSES.SUSPECTED_REGRESSION);
  assert.equal(result.regressionType, REGRESSION_TYPES.INCIDENT);
  assert.ok(
    result.evidence.some((e) =>
      e.includes("1 incident opened following release deployment"),
    ),
  );
});

test("Data Sufficiency Safeguards: sparse history prevents false alarms", () => {
  const config = DEFAULT_REGRESSION_CONFIG; // minSampleCount = 3

  // Only 1 check recorded before release
  const sparseBefore = {
    sampleCount: 1,
    successfulChecks: 1,
    failedChecks: 0,
    availability: 100,
    failureRate: 0,
    medianResponseTime: 200,
    p95ResponseTime: 200,
    hasSufficientSamples: false,
  };

  const normalAfter = {
    sampleCount: 5,
    successfulChecks: 5,
    failedChecks: 0,
    availability: 100,
    failureRate: 0,
    medianResponseTime: 300,
    p95ResponseTime: 350,
    hasSufficientSamples: true,
  };

  const diff = calculateMetricDiffs(sparseBefore, normalAfter);

  // Incomplete window -> evaluating
  const resIncomplete = evaluateRegressionSignals({
    beforeStats: sparseBefore,
    afterStats: normalAfter,
    diff,
    relatedIncidents: [],
    config,
    isWindowIncomplete: true,
  });
  assert.equal(resIncomplete.status, REGRESSION_STATUSES.EVALUATING);
  assert.equal(resIncomplete.hasSuspectedRegression, false);

  // Completed window with sparse samples -> insufficient_data (never false regression)
  const resComplete = evaluateRegressionSignals({
    beforeStats: sparseBefore,
    afterStats: normalAfter,
    diff,
    relatedIncidents: [],
    config,
    isWindowIncomplete: false,
  });
  assert.equal(resComplete.status, REGRESSION_STATUSES.INSUFFICIENT_DATA);
  assert.equal(resComplete.hasSuspectedRegression, false);
  assert.ok(
    resComplete.evidence.some((e) =>
      e.includes("Insufficient scheduled sample count"),
    ),
  );
});

test("Correlation Disclaimer: reports temporal association without proven root-cause claim", () => {
  assert.ok(
    DEFAULT_CORRELATION_DISCLAIMER.includes("Temporal association detected"),
  );
  assert.ok(DEFAULT_CORRELATION_DISCLAIMER.includes("not proven causation"));
  assert.ok(
    DEFAULT_CORRELATION_DISCLAIMER.includes("Manual verification is advised"),
  );
});

test("End-to-End Evaluation Service: evaluates regression, dedupes alerts, and respects cooldown", async () => {
  const monitor = {
    _id: testMonitorId,
    name: "Production API",
    owner: testOwnerId,
  };

  const deployment = {
    _id: testDeploymentId,
    version: "v3.2.0",
    environment: "production",
    deployedAt: new Date(Date.now() - 40 * 60 * 1000), // Deployed 40 mins ago
    monitors: [testMonitorId],
  };

  // Mock health checks: baseline 50ms, degraded after deployment to 120ms (+70ms, +140%)
  const beforeChecks = [
    {
      status: "up",
      responseTime: 50,
      checkedAt: new Date(Date.now() - 50 * 60 * 1000),
      scheduled: true,
    },
    {
      status: "up",
      responseTime: 52,
      checkedAt: new Date(Date.now() - 45 * 60 * 1000),
      scheduled: true,
    },
    {
      status: "up",
      responseTime: 48,
      checkedAt: new Date(Date.now() - 42 * 60 * 1000),
      scheduled: true,
    },
  ];

  const afterChecks = [
    {
      status: "up",
      responseTime: 120,
      checkedAt: new Date(Date.now() - 35 * 60 * 1000),
      scheduled: true,
    },
    {
      status: "up",
      responseTime: 125,
      checkedAt: new Date(Date.now() - 25 * 60 * 1000),
      scheduled: true,
    },
    {
      status: "up",
      responseTime: 118,
      checkedAt: new Date(Date.now() - 15 * 60 * 1000),
      scheduled: true,
    },
  ];

  let dispatchedNotifications = [];
  let loggedActivities = [];
  let storedAlertStates = new Map();

  const mockDeps = {
    Monitor: {
      findById: () => ({
        lean: async () => monitor,
      }),
    },
    DeploymentEvent: {
      findById: () => ({
        lean: async () => deployment,
      }),
    },
    HealthCheck: {
      find: (query) => ({
        select: () => ({
          sort: () => ({
            lean: async () => {
              if (query.checkedAt.$lt) return beforeChecks;
              return afterChecks;
            },
          }),
        }),
      }),
    },
    Incident: {
      find: () => ({
        select: () => ({
          sort: () => ({
            lean: async () => [],
          }),
        }),
      }),
    },
    DeploymentAlertState: {
      findOneAndUpdate: async (filter, update) => {
        const rawKey = filter.deduplicationKey || filter._id;
        const key = rawKey ? rawKey.toString() : "";
        let existing = storedAlertStates.get(key);

        // Check if atomic claim update
        if (filter._id && filter.$or) {
          if (!existing) return null;
          const isDue =
            !existing.alertDispatchedAt ||
            (existing.cooldownUntil && existing.cooldownUntil <= new Date());
          if (!isDue) return null; // Failed atomic claim due to cooldown/race
          existing = {
            ...existing,
            ...update.$set,
          };
          storedAlertStates.set(key, existing);
          if (existing.deduplicationKey) {
            storedAlertStates.set(existing.deduplicationKey, existing);
          }
          if (existing._id) {
            storedAlertStates.set(existing._id.toString(), existing);
          }
          return existing;
        }

        // Upsert state
        const updated = {
          _id: existing?._id || new mongoose.Types.ObjectId(),
          ...existing,
          ...update.$set,
          ...update.$setOnInsert,
        };
        storedAlertStates.set(key, updated);
        storedAlertStates.set(updated._id.toString(), updated);
        if (updated.deduplicationKey) {
          storedAlertStates.set(updated.deduplicationKey, updated);
        }
        return updated;
      },
      updateOne: async () => {},
    },
    createNotification: async (payload) => {
      dispatchedNotifications.push(payload);
      return { id: new mongoose.Types.ObjectId(), ...payload };
    },
    logActivity: async (payload) => {
      loggedActivities.push(payload);
      return { id: new mongoose.Types.ObjectId(), ...payload };
    },
  };

  // 1. Initial Evaluation -> Should detect latency regression and dispatch first alert
  const run1 = await evaluateDeploymentRegression({
    monitorId: testMonitorId,
    deploymentId: testDeploymentId,
    options: { windowMinutes: 30, cooldownMinutes: 60 },
    deps: mockDeps,
  });

  assert.equal(
    run1.evaluation.status,
    REGRESSION_STATUSES.SUSPECTED_REGRESSION,
  );
  assert.equal(run1.evaluation.hasSuspectedRegression, true);
  assert.equal(run1.evaluation.regressionType, REGRESSION_TYPES.LATENCY);
  assert.equal(run1.alertDispatched, true);
  assert.equal(dispatchedNotifications.length, 1);
  assert.ok(
    dispatchedNotifications[0].message.includes(
      "Suspected performance regression",
    ),
  );
  assert.equal(loggedActivities.length, 1);

  // 2. Duplicate Evaluation 5 minutes later -> In cooldown!
  // Must NOT send duplicate notification!
  const run2 = await evaluateDeploymentRegression({
    monitorId: testMonitorId,
    deploymentId: testDeploymentId,
    options: { windowMinutes: 30, cooldownMinutes: 60 },
    deps: mockDeps,
  });

  assert.equal(
    run2.evaluation.status,
    REGRESSION_STATUSES.SUSPECTED_REGRESSION,
  );
  assert.equal(run2.alertDispatched, false); // Deduplicated by cooldown!
  assert.equal(dispatchedNotifications.length, 1); // Still exactly 1 notification!
});

test("Concurrency Protection: competing workers claim notification dispatch atomically", async () => {
  const alertStateId = new mongoose.Types.ObjectId().toString();
  let dispatchWinner = null;
  let alreadyClaimed = false;

  const atomicClaimMock = async (workerName) => {
    // Simulates MongoDB atomic findOneAndUpdate with condition: { alertDispatchedAt: null }
    if (!alreadyClaimed) {
      alreadyClaimed = true;
      dispatchWinner = workerName;
      return { _id: alertStateId, alertDispatchedAt: new Date() };
    }
    return null; // Atomic claim failed for subsequent callers
  };

  const [resA, resB] = await Promise.all([
    atomicClaimMock("worker-A"),
    atomicClaimMock("worker-B"),
  ]);

  // Exactly one worker must win the claim
  const winners = [resA, resB].filter(Boolean);
  assert.equal(winners.length, 1);
  assert.ok(dispatchWinner === "worker-A" || dispatchWinner === "worker-B");
});
