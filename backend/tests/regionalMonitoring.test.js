import test from "node:test";
import assert from "node:assert/strict";
import { HEALTH_STATUS, PLANS } from "../src/config/constants.js";
import { getPlanDefinition } from "../src/config/plans.js";
import {
  aggregateRegionalResults,
  acceptRegionalProbeResult,
  evaluateRegionalPerformance,
} from "../src/services/regionalProbe.service.js";
import { assertRegionalMonitoringAllowed } from "../src/services/monitor.service.js";

test("regional plan caps and account probe budgets are centralized", () => {
  assert.equal(getPlanDefinition(PLANS.FREE).limits.maxRegionsPerMonitor, 1);
  assert.equal(getPlanDefinition(PLANS.PRO).limits.maxRegionsPerMonitor, 3);
  assert.equal(
    getPlanDefinition(PLANS.UNLIMITED).limits.maxRegionsPerMonitor,
    4,
  );
  assert.equal(getPlanDefinition(PLANS.FREE).limits.regionalChecksPerDay, 3000);
  assert.equal(
    getPlanDefinition(PLANS.UNLIMITED).limits.regionalChecksPerDay,
    null,
  );
});

test("regional configuration rejects region counts above plan entitlement", async () => {
  await assert.rejects(
    assertRegionalMonitoringAllowed(
      { id: "user", plan: PLANS.FREE },
      { enabled: true, regions: ["india-mumbai", "us-east"] },
      300,
    ),
    (error) => error.code === "UPGRADE_REQUIRED",
  );
  await assert.rejects(
    assertRegionalMonitoringAllowed(
      { id: "user", plan: PLANS.PRO },
      {
        enabled: true,
        regions: ["india-mumbai", "us-east", "eu-west", "singapore"],
      },
      300,
    ),
    (error) => error.code === "UPGRADE_REQUIRED",
  );
});

test("regional aggregation uses strict majority and excludes missing or unknown probes", () => {
  const run = {
    expectedRegions: ["india-mumbai", "us-east", "eu-west", "singapore"],
  };
  const check = (healthStatus) => ({
    healthStatus,
    httpStatus: 200,
    responseTime: 200,
    timings: {},
  });
  assert.equal(
    aggregateRegionalResults(run, [
      check("up"),
      check("up"),
      check("up"),
      check("up"),
    ]).status,
    HEALTH_STATUS.UP,
  );
  assert.equal(
    aggregateRegionalResults(run, [
      check("down"),
      check("up"),
      check("up"),
      check("up"),
    ]).status,
    HEALTH_STATUS.DEGRADED,
  );
  assert.equal(
    aggregateRegionalResults(run, [
      check("down"),
      check("down"),
      check("down"),
      check("up"),
    ]).status,
    HEALTH_STATUS.DOWN,
  );
  assert.equal(
    aggregateRegionalResults(run, [check("up"), check("unknown")]).status,
    HEALTH_STATUS.UNKNOWN,
  );
});

test("regional probe result submission ignores duplicates and rejects stale leases", async () => {
  const job = {
    _id: "job-1",
    regionId: "india-mumbai",
    leaseAgentId: "agent-mumbai",
    leaseToken: "lease-token-123456789012345",
    jobStatus: "complete",
  };
  const deps = {
    RegionalCheck: { findById: () => ({ select: async () => job }) },
  };
  const agent = { agentId: "agent-mumbai", regionId: "india-mumbai" };
  const duplicate = await acceptRegionalProbeResult(
    "job-1",
    agent,
    { leaseToken: job.leaseToken },
    deps,
  );
  assert.deepEqual(duplicate, { accepted: true, duplicate: true });
  const stale = await acceptRegionalProbeResult(
    "job-1",
    agent,
    { leaseToken: "old-lease" },
    deps,
  );
  assert.equal(stale.reason, "stale_lease");
});

test("regional response-time anomaly detection warms and alerts independently", async () => {
  const state = {
    status: "normal",
    baselineSamples: [],
    recentSamples: [],
    consecutiveBreaches: 0,
    consecutiveRecoveries: 0,
    save: async () => {},
  };
  const notifications = [];
  const deps = {
    RegionalPerformanceState: { findOneAndUpdate: async () => state },
    RegionalCheck: {
      find: () => ({
        sort() {
          return this;
        },
        limit() {
          return this;
        },
        select() {
          return this;
        },
        lean: async () => [],
      }),
    },
    Monitor: {
      findById: () => ({
        select() {
          return this;
        },
        lean: async () => ({ _id: "monitor", owner: "owner", name: "API" }),
      }),
    },
    createNotification: async (event) => notifications.push(event),
  };
  const monitor = "64b000000000000000000070";
  for (let index = 0; index < 20; index += 1) {
    await evaluateRegionalPerformance(
      {
        _id: `normal-${index}`,
        monitor,
        regionId: "india-mumbai",
        healthStatus: "up",
        httpStatus: 200,
        responseTime: 200,
        completedAt: new Date(Date.now() + index),
      },
      deps,
    );
  }
  for (let index = 0; index < 7; index += 1) {
    await evaluateRegionalPerformance(
      {
        _id: `slow-${index}`,
        monitor,
        regionId: "india-mumbai",
        healthStatus: "up",
        httpStatus: 200,
        responseTime: 600,
        completedAt: new Date(Date.now() + 100 + index),
      },
      deps,
    );
  }
  assert.equal(state.status, "degraded");
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].type, "regional_performance_degraded");
});
