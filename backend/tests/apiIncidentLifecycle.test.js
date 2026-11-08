import test from "node:test";
import assert from "node:assert/strict";
import { handleIncident } from "../src/workers/incidentManager.js";
import { classifyApiResult } from "../src/workers/apiClassifier.js";
import { evaluateAssertions } from "../src/workers/assertionEvaluator.js";
import {
  HEALTH_STATUS,
  INCIDENT_STATUS,
  FAILURE_REASONS,
} from "../src/config/constants.js";
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
    _id: "api-mon-1",
    name: "Orders API",
    owner: "user-1",
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
      ) {
        return null;
      }
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
      if ("consecutiveFailures" in update.$set) {
        state.failures = update.$set.consecutiveFailures;
      }
      if ("consecutiveSuccesses" in update.$set) {
        state.successes = update.$set.consecutiveSuccesses;
      }
      return monitorDocument();
    },
    findById() {
      return { select: async () => monitorDocument() };
    },
  };

  return {
    state,
    deps: {
      Monitor,
      Incident,
      logActivity: async (event) => state.activities.push(event),
      createNotification: async (n) => state.notifications.push(n),
      syncStatusIncident: async () => {},
    },
  };
};

test("API Incidents: consecutive assertion failures open an incident with safe root cause", async () => {
  const { state, deps } = makeHarness();
  const monitor = {
    _id: "api-mon-1",
    name: "Orders API",
    owner: "user-1",
    kind: "api",
    apiConfig: {
      expectedStatusCodes: [200],
      assertions: [
        {
          id: "assert-1",
          type: "statusCode",
          comparison: "equals",
          targetValue: 200,
        },
      ],
    },
  };

  const makeAssertionFailureCheck = (id) => {
    const rawResult = {
      transportCompleted: true,
      httpStatus: 500,
      responseTime: 180,
      headers: {},
      body: '{"error": "Internal Server Error"}',
    };
    const evalResult = evaluateAssertions(monitor.apiConfig.assertions, {
      httpStatus: 500,
      responseTime: 180,
      headers: {},
      body: rawResult.body,
    });
    const classification = classifyApiResult(
      rawResult,
      monitor.apiConfig,
      evalResult,
    );

    return {
      _id: id,
      monitor: monitor._id,
      status: classification.status,
      httpStatus: rawResult.httpStatus,
      failureReason: classification.failureReason,
      diagnostics: classification.diagnostics,
      checkedAt: new Date(),
    };
  };

  // Threshold is env.CONSECUTIVE_FAILURE_THRESHOLD (typically 3)
  const threshold = env.CONSECUTIVE_FAILURE_THRESHOLD || 3;
  for (let i = 1; i <= threshold; i++) {
    const check = makeAssertionFailureCheck(`check-${i}`);
    await handleIncident(monitor, check, deps);
  }

  assert.equal(state.failures, threshold);
  assert.equal(state.incidents.length, 1);
  assert.equal(state.activeIncident.status, INCIDENT_STATUS.ONGOING);
  assert.match(
    state.activeIncident.rootCause,
    /Status code was 500, expected 200/,
  );
  assert.equal(state.notifications.length, 1);
});

test("API Incidents: consecutive successes auto-resolve active API monitor incident", async () => {
  const initialIncident = {
    _id: "incident-api-1",
    monitor: "api-mon-1",
    status: INCIDENT_STATUS.ONGOING,
    severity: "critical",
    startedAt: new Date(Date.now() - 60000),
    statusHistory: [{ status: INCIDENT_STATUS.ONGOING, changedAt: new Date() }],
  };

  const { state, deps } = makeHarness({
    failures: 3,
    successes: 0,
    activeIncident: initialIncident,
  });

  const monitor = {
    _id: "api-mon-1",
    name: "Orders API",
    owner: "user-1",
    kind: "api",
  };

  const makeSuccessCheck = (id) => ({
    _id: id,
    monitor: monitor._id,
    status: HEALTH_STATUS.UP,
    httpStatus: 200,
    failureReason: null,
    checkedAt: new Date(),
  });

  const recoveryThreshold = env.CONSECUTIVE_SUCCESS_THRESHOLD || 2;
  for (let i = 1; i <= recoveryThreshold; i++) {
    const check = makeSuccessCheck(`check-rec-${i}`);
    await handleIncident(monitor, check, deps);
  }

  assert.equal(state.failures, 0);
  assert.equal(state.successes, recoveryThreshold);
  assert.equal(state.activeIncident.status, INCIDENT_STATUS.RESOLVED);
  assert.equal(state.resolvedUpdates, 1);
  assert.equal(state.notifications.length, 1);
  assert.match(state.notifications[0].title, /back up/);
});
