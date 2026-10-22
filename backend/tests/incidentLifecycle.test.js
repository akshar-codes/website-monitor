import test from "node:test";
import assert from "node:assert/strict";
import { handleIncident } from "../src/workers/incidentManager.js";
import { classify } from "../src/workers/classifier.js";
import { HEALTH_STATUS, INCIDENT_STATUS } from "../src/config/constants.js";
import env from "../src/config/env.js";

const makeHarness = ({
  failures = 0,
  successes = 0,
  activeIncident = null,
} = {}) => {
  const state = {
    failures,
    successes,
    lastIncidentCheckId: null,
    activeIncident,
    incidents: [],
    activities: [],
    notifications: [],
    resolvedUpdates: 0,
  };
  const monitorDocument = () => ({
    _id: "monitor-1",
    consecutiveFailures: state.failures,
    consecutiveSuccesses: state.successes,
    lastIncidentCheckId: state.lastIncidentCheckId,
  });
  const Incident = {
    async updateOne(_filter, update) {
      if (state.activeIncident) return { matchedCount: 1, upsertedCount: 0 };
      state.activeIncident = {
        _id: `incident-${state.incidents.length + 1}`,
        ...update.$setOnInsert,
      };
      state.incidents.push(state.activeIncident);
      return { matchedCount: 0, upsertedCount: 1 };
    },
    findOne() {
      return { sort: async () => state.activeIncident };
    },
    async findOneAndUpdate(_filter, update) {
      if (
        !state.activeIncident ||
        state.activeIncident.status === INCIDENT_STATUS.RESOLVED
      )
        return null;
      state.resolvedUpdates += 1;
      Object.assign(state.activeIncident, update.$set);
      state.activeIncident.statusHistory.push(update.$push.statusHistory);
      return state.activeIncident;
    },
  };
  const Monitor = {
    async findOneAndUpdate(_filter, update) {
      const checkId = update.$set.lastIncidentCheckId;
      if (state.lastIncidentCheckId === checkId) return null;
      state.lastIncidentCheckId = checkId;
      state.failures += update.$inc.consecutiveFailures || 0;
      state.successes += update.$inc.consecutiveSuccesses || 0;
      if ("consecutiveFailures" in update.$set)
        state.failures = update.$set.consecutiveFailures;
      if ("consecutiveSuccesses" in update.$set)
        state.successes = update.$set.consecutiveSuccesses;
      return monitorDocument();
    },
    findById() {
      return { select: async () => monitorDocument() };
    },
  };
  return {
    state,
    overrides: {
      Monitor,
      Incident,
      logActivity: async (entry) => state.activities.push(entry),
      createNotification: async (entry) => state.notifications.push(entry),
    },
  };
};

const monitor = { _id: "monitor-1", owner: "owner-1", name: "API" };
const failedCheck = (id) => ({
  _id: id,
  status: HEALTH_STATUS.DOWN,
  failureReason: "http_error",
  checkedAt: new Date("2026-01-01T00:00:00Z"),
});
const healthyCheck = (id) => ({
  _id: id,
  status: HEALTH_STATUS.UP,
  checkedAt: new Date("2026-01-01T00:01:00Z"),
  responseTime: 12,
});

test("opens one incident after the configured consecutive-failure threshold", async () => {
  const { state, overrides } = makeHarness();
  for (let count = 1; count < env.CONSECUTIVE_FAILURE_THRESHOLD; count += 1) {
    await handleIncident(monitor, failedCheck(`failure-${count}`), overrides);
    assert.equal(state.incidents.length, 0);
  }
  await handleIncident(
    monitor,
    failedCheck(`failure-${env.CONSECUTIVE_FAILURE_THRESHOLD}`),
    overrides,
  );
  assert.equal(state.incidents.length, 1);
  assert.equal(
    state.activeIncident.triggerCheck,
    `failure-${env.CONSECUTIVE_FAILURE_THRESHOLD}`,
  );
  assert.equal(
    state.activeIncident.startedAt.toISOString(),
    "2026-01-01T00:00:00.000Z",
  );
  assert.equal(state.activities[0].action, "incident_auto_opened");
  assert.equal(state.notifications[0].type, "incident_opened");
});

test("deduplicates replayed checks and concurrent incident creation", async () => {
  const { state, overrides } = makeHarness();
  for (let count = 1; count < env.CONSECUTIVE_FAILURE_THRESHOLD; count += 1) {
    await handleIncident(monitor, failedCheck(`failure-${count}`), overrides);
  }
  const thresholdCheck = failedCheck(
    `failure-${env.CONSECUTIVE_FAILURE_THRESHOLD}`,
  );
  await Promise.all([
    handleIncident(monitor, thresholdCheck, overrides),
    handleIncident(monitor, thresholdCheck, overrides),
  ]);
  assert.equal(state.failures, env.CONSECUTIVE_FAILURE_THRESHOLD);
  assert.equal(state.incidents.length, 1);
  assert.equal(
    state.activities.filter((entry) => entry.action === "incident_auto_opened")
      .length,
    1,
  );
  assert.equal(
    state.notifications.filter((entry) => entry.type === "incident_opened")
      .length,
    1,
  );
});

test("resolves an active incident after two consecutive successes and records duration", async () => {
  const incident = {
    _id: "incident-1",
    startedAt: new Date("2026-01-01T00:00:00Z"),
    status: INCIDENT_STATUS.ONGOING,
    statusHistory: [{ status: INCIDENT_STATUS.ONGOING }],
  };
  const { state, overrides } = makeHarness({
    failures: 2,
    activeIncident: incident,
  });
  for (let count = 1; count < env.CONSECUTIVE_SUCCESS_THRESHOLD; count += 1) {
    await handleIncident(monitor, healthyCheck(`healthy-${count}`), overrides);
    assert.equal(state.resolvedUpdates, 0);
  }
  await handleIncident(
    monitor,
    healthyCheck(`healthy-${env.CONSECUTIVE_SUCCESS_THRESHOLD}`),
    overrides,
  );
  assert.equal(state.activeIncident.status, INCIDENT_STATUS.RESOLVED);
  assert.equal(
    state.activeIncident.recoveryCheck,
    `healthy-${env.CONSECUTIVE_SUCCESS_THRESHOLD}`,
  );
  assert.equal(state.activeIncident.duration, 60);
  assert.equal(state.activities[0].action, "incident_auto_resolved");
  assert.equal(state.notifications[0].type, "incident_resolved");
});

test("recovery retries and intermittent failures do not prematurely resolve incidents", async () => {
  const incident = {
    _id: "incident-1",
    startedAt: new Date("2026-01-01T00:00:00Z"),
    status: INCIDENT_STATUS.ONGOING,
    statusHistory: [{ status: INCIDENT_STATUS.ONGOING }],
  };
  const { state, overrides } = makeHarness({
    failures: 2,
    activeIncident: incident,
  });
  await handleIncident(
    monitor,
    healthyCheck("healthy-before-failure"),
    overrides,
  );
  await handleIncident(monitor, failedCheck("failure-reset"), overrides);
  for (let count = 1; count <= env.CONSECUTIVE_SUCCESS_THRESHOLD; count += 1) {
    await handleIncident(
      monitor,
      healthyCheck(`healthy-after-failure-${count}`),
      overrides,
    );
    if (count < env.CONSECUTIVE_SUCCESS_THRESHOLD)
      assert.equal(state.resolvedUpdates, 0);
  }
  assert.equal(state.resolvedUpdates, 1);
});

test("healthy to failing to recovered lifecycle emits exactly one event per transition", async () => {
  const { state, overrides } = makeHarness();
  const asCheck = (id, raw, minute) => ({
    _id: id,
    ...classify(raw),
    checkedAt: new Date(`2026-01-01T00:${String(minute).padStart(2, "0")}:00Z`),
  });
  const healthy = {
    ok: true,
    httpStatus: 200,
    body: {
      status: "ok",
      services: { frontend: "up", backend: "up", database: "up" },
    },
  };
  const failed = {
    ok: false,
    httpStatus: null,
    body: null,
    failureReason: "timeout",
  };

  await handleIncident(
    monitor,
    asCheck("healthy-start", healthy, 0),
    overrides,
  );
  for (let index = 1; index <= env.CONSECUTIVE_FAILURE_THRESHOLD; index += 1) {
    await handleIncident(
      monitor,
      asCheck(`down-${index}`, failed, index),
      overrides,
    );
  }
  assert.equal(state.incidents.length, 1);
  assert.equal(
    state.notifications.filter(({ type }) => type === "incident_opened").length,
    1,
  );

  for (let index = 1; index <= env.CONSECUTIVE_SUCCESS_THRESHOLD; index += 1) {
    await handleIncident(
      monitor,
      asCheck(`recovered-${index}`, healthy, index + 2),
      overrides,
    );
  }
  assert.equal(state.activeIncident.status, INCIDENT_STATUS.RESOLVED);
  assert.equal(
    state.notifications.filter(({ type }) => type === "incident_resolved")
      .length,
    1,
  );
  assert.equal(state.notifications.length, 2);
});
