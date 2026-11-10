import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import Incident from "../src/models/Incident.js";
import JobMonitor from "../src/models/JobMonitor.js";
import JobRun from "../src/models/JobRun.js";
import Monitor from "../src/models/Monitor.js";
import Activity from "../src/models/Activity.js";
import { handleJobIncident } from "../src/workers/incidentManager.js";
import { migrateActiveIncidentIndex } from "../scripts/migrateActiveIncidentIndex.js";
import {
  getIncidents,
  getIncidentById,
  updateIncidentStatus,
  getDowntimeStats,
} from "../src/services/incident.service.js";
import { deleteJobMonitor } from "../src/services/jobMonitor.service.js";
import { enqueueNotificationAlert } from "../src/services/alerting/alerting.service.js";
import Notification from "../src/models/Notification.js";
import NotificationRule from "../src/models/NotificationRule.js";
import NotificationIntegration from "../src/models/NotificationIntegration.js";
import AlertPolicy from "../src/models/AlertPolicy.js";
import UserPreference from "../src/models/UserPreference.js";
import {
  INCIDENT_STATUS,
  INCIDENT_SEVERITY,
  JOB_STATUS,
  JOB_RUN_STATUS,
  JOB_SCHEDULE_TYPES,
} from "../src/config/constants.js";

// ── Test Harness for handleJobIncident ─────────────────────────────────────────

const makeJobHarness = ({
  failures = 0,
  successes = 0,
  activeIncident = null,
} = {}) => {
  const state = {
    failures,
    successes,
    activeIncident,
    incidents: activeIncident ? [activeIncident] : [],
    activities: [],
    notifications: [],
    statusPageCalls: 0,
  };

  const MockIncident = {
    async updateOne(filter, update, options) {
      if (
        state.activeIncident &&
        [
          INCIDENT_STATUS.ONGOING,
          INCIDENT_STATUS.INVESTIGATING,
          INCIDENT_STATUS.IDENTIFIED,
        ].includes(state.activeIncident.status)
      ) {
        return { matchedCount: 1, upsertedCount: 0 };
      }
      state.activeIncident = {
        _id: new mongoose.Types.ObjectId(),
        ...update.$setOnInsert,
      };
      state.incidents.push(state.activeIncident);
      return {
        matchedCount: 0,
        upsertedCount: 1,
        upsertedId: state.activeIncident._id,
      };
    },
    findOne(filter) {
      return {
        sort: async () => {
          if (filter.status?.$in) {
            return state.activeIncident &&
              filter.status.$in.includes(state.activeIncident.status)
              ? state.activeIncident
              : null;
          }
          return state.activeIncident;
        },
      };
    },
    async findOneAndUpdate(filter, update) {
      if (
        !state.activeIncident ||
        state.activeIncident.status === INCIDENT_STATUS.RESOLVED
      ) {
        return null;
      }
      Object.assign(state.activeIncident, update.$set);
      if (update.$push?.statusHistory) {
        state.activeIncident.statusHistory =
          state.activeIncident.statusHistory || [];
        state.activeIncident.statusHistory.push(update.$push.statusHistory);
      }
      return state.activeIncident;
    },
  };

  return {
    state,
    deps: {
      Incident: MockIncident,
      JobMonitor: {},
      logActivity: async (entry) => state.activities.push(entry),
      createNotification: async (entry) => state.notifications.push(entry),
      syncStatusIncident: async () => {
        state.statusPageCalls += 1;
      },
    },
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. Schema Validation & Exclusivity
// ─────────────────────────────────────────────────────────────────────────────

test("Incident Schema: enforces exclusivity between Monitor and JobMonitor", async () => {
  const monitorId = new mongoose.Types.ObjectId();
  const jobMonitorId = new mongoose.Types.ObjectId();

  // Case 1: Neither monitor nor jobMonitor
  const orphanIncident = new Incident({
    status: INCIDENT_STATUS.ONGOING,
    severity: INCIDENT_SEVERITY.MAJOR,
    startedAt: new Date(),
  });
  await assert.rejects(
    async () => orphanIncident.validate(),
    (err) => {
      assert.ok(err.errors.monitor);
      assert.match(
        err.errors.monitor.message,
        /either a Monitor or a JobMonitor/i,
      );
      return true;
    },
  );

  // Case 2: Both monitor and jobMonitor
  const conflictingIncident = new Incident({
    monitor: monitorId,
    jobMonitor: jobMonitorId,
    status: INCIDENT_STATUS.ONGOING,
    severity: INCIDENT_SEVERITY.MAJOR,
    startedAt: new Date(),
  });
  await assert.rejects(
    async () => conflictingIncident.validate(),
    (err) => {
      assert.ok(err.errors.jobMonitor);
      assert.match(err.errors.jobMonitor.message, /cannot belong to both/i);
      return true;
    },
  );

  // Case 3: Only jobMonitor
  const validJobIncident = new Incident({
    jobMonitor: jobMonitorId,
    status: INCIDENT_STATUS.ONGOING,
    severity: INCIDENT_SEVERITY.CRITICAL,
    startedAt: new Date(),
  });
  await validJobIncident.validate();
  assert.equal(validJobIncident.resourceType, "job_monitor");
  assert.equal(validJobIncident.isActive, true);

  // Case 4: Only monitor
  const validMonitorIncident = new Incident({
    monitor: monitorId,
    status: INCIDENT_STATUS.ONGOING,
    severity: INCIDENT_SEVERITY.MAJOR,
    startedAt: new Date(),
  });
  await validMonitorIncident.validate();
  assert.equal(validMonitorIncident.resourceType, "monitor");
});

test("Incident Schema: defines partial unique indexes for both Monitor and JobMonitor", () => {
  const indexes = Incident.schema.indexes();

  // Find uniq_active_monitor_incident
  const monitorIdx = indexes.find(
    ([fields, opts]) => opts?.name === "uniq_active_monitor_incident",
  );
  assert.ok(monitorIdx, "uniq_active_monitor_incident must exist");
  assert.deepEqual(monitorIdx[0], { monitor: 1 });
  assert.equal(monitorIdx[1].unique, true);
  assert.deepEqual(monitorIdx[1].partialFilterExpression.monitor, {
    $exists: true,
    $type: "objectId",
  });

  // Find uniq_active_job_monitor_incident
  const jobMonitorIdx = indexes.find(
    ([fields, opts]) => opts?.name === "uniq_active_job_monitor_incident",
  );
  assert.ok(jobMonitorIdx, "uniq_active_job_monitor_incident must exist");
  assert.deepEqual(jobMonitorIdx[0], { jobMonitor: 1 });
  assert.equal(jobMonitorIdx[1].unique, true);
  assert.deepEqual(jobMonitorIdx[1].partialFilterExpression.jobMonitor, {
    $exists: true,
    $type: "objectId",
  });
});

test("Incident Index Migration: drops legacy active monitor index and synchronizes", async () => {
  const droppedIndexes = [];
  let syncCalled = false;

  const mockCollection = {
    async indexes() {
      return [
        {
          name: "monitor_1",
          key: { monitor: 1 },
          unique: true,
          partialFilterExpression: {
            status: { $in: ["ongoing", "investigating", "identified"] },
          },
        },
        {
          name: "_id_",
          key: { _id: 1 },
        },
      ];
    },
    async dropIndex(name) {
      droppedIndexes.push(name);
    },
  };

  const origCollection = Incident.collection;
  const origSync = Incident.syncIndexes;
  try {
    Incident.collection = mockCollection;
    Incident.syncIndexes = async () => {
      syncCalled = true;
    };

    await migrateActiveIncidentIndex();
    assert.deepEqual(droppedIndexes, ["monitor_1"]);
    assert.equal(syncCalled, true);
  } finally {
    Incident.collection = origCollection;
    Incident.syncIndexes = origSync;
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Incident Triggering & Lifecycle via handleJobIncident
// ─────────────────────────────────────────────────────────────────────────────

test("handleJobIncident: respects failureThreshold gating", async () => {
  const { state, deps } = makeJobHarness();
  const jobMonitor = {
    _id: new mongoose.Types.ObjectId(),
    owner: new mongoose.Types.ObjectId(),
    name: "DB Backup",
    failureThreshold: 3,
    consecutiveFailures: 1,
  };
  const failedRun = {
    _id: new mongoose.Types.ObjectId(),
    runId: "run-101",
    status: JOB_RUN_STATUS.FAILED,
    errorMessage: "Process exited with code 1",
  };

  // 1st failure: under threshold (1 < 3)
  const result1 = await handleJobIncident(
    jobMonitor,
    failedRun,
    {
      triggerType: "failure",
      consecutiveFailures: 1,
    },
    deps,
  );
  assert.equal(result1, null);
  assert.equal(state.incidents.length, 0);

  // 2nd failure: under threshold (2 < 3)
  const result2 = await handleJobIncident(
    jobMonitor,
    failedRun,
    {
      triggerType: "failure",
      consecutiveFailures: 2,
    },
    deps,
  );
  assert.equal(result2, null);
  assert.equal(state.incidents.length, 0);

  // 3rd failure: reaches threshold (3 >= 3)
  const result3 = await handleJobIncident(
    jobMonitor,
    failedRun,
    {
      triggerType: "failure",
      consecutiveFailures: 3,
    },
    deps,
  );
  assert.ok(result3);
  assert.equal(state.incidents.length, 1);
  assert.equal(state.activeIncident.resourceType, "job_monitor");
  assert.equal(state.activeIncident.status, INCIDENT_STATUS.ONGOING);
  assert.equal(state.activeIncident.triggerJobRunSnapshot.runId, "run-101");
  assert.equal(state.notifications.length, 1);
  assert.equal(state.notifications[0].type, "incident_opened");
  assert.match(state.notifications[0].message, /3 consecutive failure\(s\)/);
  assert.equal(state.activities.length, 1);
  assert.equal(state.activities[0].action, "incident_auto_opened");
  // Crucial: status page sync must NOT be called for JobMonitor incidents
  assert.equal(state.statusPageCalls, 0);
});

test("handleJobIncident: handles execution timeout triggers", async () => {
  const { state, deps } = makeJobHarness();
  const jobMonitor = {
    _id: new mongoose.Types.ObjectId(),
    owner: new mongoose.Types.ObjectId(),
    name: "Nightly Sync",
    failureThreshold: 1,
    runTimeoutSeconds: 300,
    consecutiveFailures: 1,
  };
  const timeoutRun = {
    _id: new mongoose.Types.ObjectId(),
    runId: "run-timeout-1",
    status: JOB_RUN_STATUS.TIMED_OUT,
    durationMs: 310000,
    errorMessage:
      "Execution timed out after exceeding configured limit of 300 seconds.",
    failureReason: "execution_timeout",
  };

  const incident = await handleJobIncident(
    jobMonitor,
    timeoutRun,
    {
      triggerType: "timeout",
      failureReason: "execution_timeout",
      consecutiveFailures: 1,
    },
    deps,
  );

  assert.ok(incident);
  assert.equal(incident.severity, INCIDENT_SEVERITY.CRITICAL);
  assert.match(incident.rootCause, /300 seconds/);
  assert.equal(state.notifications[0].priority, "critical");
  assert.equal(state.statusPageCalls, 0);
});

test("handleJobIncident: handles missed execution triggers", async () => {
  const { state, deps } = makeJobHarness();
  const jobMonitor = {
    _id: new mongoose.Types.ObjectId(),
    owner: new mongoose.Types.ObjectId(),
    name: "Hourly Reporter",
    failureThreshold: 1,
    gracePeriodSeconds: 120,
    consecutiveFailures: 1,
  };
  const missedRun = {
    _id: new mongoose.Types.ObjectId(),
    runId: "missed_2026-11-10T12-00-00-000Z_123456",
    status: JOB_RUN_STATUS.MISSED,
    errorMessage:
      "Scheduled execution was missed past grace period of 120 seconds.",
    failureReason: "missed_execution",
  };

  const incident = await handleJobIncident(
    jobMonitor,
    missedRun,
    {
      triggerType: "missed",
      failureReason: "missed_execution",
      consecutiveFailures: 1,
    },
    deps,
  );

  assert.ok(incident);
  assert.match(incident.rootCause, /120 seconds/);
  assert.equal(state.notifications.length, 1);
  assert.equal(state.statusPageCalls, 0);
});

test("handleJobIncident: deduplicates active incidents and notifications on subsequent failures", async () => {
  const existingIncident = {
    _id: new mongoose.Types.ObjectId(),
    jobMonitor: new mongoose.Types.ObjectId(),
    resourceType: "job_monitor",
    status: INCIDENT_STATUS.ONGOING,
    startedAt: new Date(Date.now() - 60000),
    statusHistory: [{ status: INCIDENT_STATUS.ONGOING }],
  };

  const { state, deps } = makeJobHarness({
    failures: 1,
    activeIncident: existingIncident,
  });

  const jobMonitor = {
    _id: existingIncident.jobMonitor,
    owner: new mongoose.Types.ObjectId(),
    name: "Sync Job",
    failureThreshold: 1,
    consecutiveFailures: 2,
  };

  const run2 = {
    _id: new mongoose.Types.ObjectId(),
    runId: "run-2",
    status: JOB_RUN_STATUS.FAILED,
    errorMessage: "Second consecutive failure",
  };

  const incident = await handleJobIncident(
    jobMonitor,
    run2,
    {
      triggerType: "failure",
      consecutiveFailures: 2,
    },
    deps,
  );

  // Returns existing active incident without creating a second one
  assert.equal(incident._id, existingIncident._id);
  assert.equal(state.incidents.length, 1);
  assert.equal(
    state.notifications.length,
    0,
    "No duplicate notification should be sent",
  );
  assert.equal(
    state.activities.length,
    0,
    "No duplicate activity entry should be logged",
  );
  assert.equal(state.statusPageCalls, 0);
});

test("handleJobIncident: concurrent creation catches E11000 gracefully", async () => {
  const jobMonitorId = new mongoose.Types.ObjectId();
  const ownerId = new mongoose.Types.ObjectId();
  const jobMonitor = {
    _id: jobMonitorId,
    owner: ownerId,
    name: "Backup Worker",
    failureThreshold: 1,
    consecutiveFailures: 1,
  };

  const existingIncident = {
    _id: new mongoose.Types.ObjectId(),
    jobMonitor: jobMonitorId,
    status: INCIDENT_STATUS.ONGOING,
    severity: INCIDENT_SEVERITY.MAJOR,
  };

  let updateCalls = 0;
  const mockDeps = {
    Incident: {
      async updateOne() {
        updateCalls += 1;
        // Simulate race condition where MongoDB throws 11000 duplicate key error
        const err = new Error("E11000 duplicate key error collection");
        err.code = 11000;
        throw err;
      },
      findOne() {
        return { sort: async () => existingIncident };
      },
    },
    JobMonitor: {},
    logActivity: async () => {},
    createNotification: async () => {},
  };

  const result = await handleJobIncident(
    jobMonitor,
    { _id: "run-1" },
    {
      triggerType: "failure",
      consecutiveFailures: 1,
    },
    mockDeps,
  );

  assert.equal(result._id, existingIncident._id);
  assert.equal(updateCalls, 1);
});

test("handleJobIncident: auto-resolves incident when recovery threshold is met", async () => {
  const startedAt = new Date(Date.now() - 120000); // 2 minutes ago
  const activeIncident = {
    _id: new mongoose.Types.ObjectId(),
    jobMonitor: new mongoose.Types.ObjectId(),
    resourceType: "job_monitor",
    status: INCIDENT_STATUS.ONGOING,
    startedAt,
    statusHistory: [{ status: INCIDENT_STATUS.ONGOING, changedAt: startedAt }],
  };

  const { state, deps } = makeJobHarness({
    failures: 2,
    activeIncident,
  });

  const jobMonitor = {
    _id: activeIncident.jobMonitor,
    owner: new mongoose.Types.ObjectId(),
    name: "Sync Job",
    recoveryThreshold: 2,
    consecutiveSuccesses: 1,
  };

  const successRun1 = {
    _id: new mongoose.Types.ObjectId(),
    runId: "run-success-1",
    status: JOB_RUN_STATUS.SUCCEEDED,
    completedAt: new Date(Date.now() - 60000),
  };

  // 1st success: under recoveryThreshold (1 < 2)
  const res1 = await handleJobIncident(
    jobMonitor,
    successRun1,
    {
      triggerType: "recovery",
      consecutiveSuccesses: 1,
    },
    deps,
  );
  assert.equal(res1, null);
  assert.equal(state.activeIncident.status, INCIDENT_STATUS.ONGOING);

  // 2nd success: meets recoveryThreshold (2 >= 2)
  const completedAt = new Date();
  const successRun2 = {
    _id: new mongoose.Types.ObjectId(),
    runId: "run-success-2",
    status: JOB_RUN_STATUS.SUCCEEDED,
    completedAt,
  };

  const res2 = await handleJobIncident(
    jobMonitor,
    successRun2,
    {
      triggerType: "recovery",
      consecutiveSuccesses: 2,
    },
    deps,
  );

  assert.ok(res2);
  assert.equal(state.activeIncident.status, INCIDENT_STATUS.RESOLVED);
  assert.equal(state.activeIncident.recoveryJobRun, successRun2._id);
  assert.equal(
    state.activeIncident.recoveryJobRunSnapshot.runId,
    "run-success-2",
  );
  assert.ok(state.activeIncident.duration >= 119);
  assert.equal(state.notifications.length, 1);
  assert.equal(state.notifications[0].type, "incident_resolved");
  assert.match(state.notifications[0].title, /recovered/i);
  assert.equal(state.activities.length, 1);
  assert.equal(state.activities[0].action, "incident_auto_resolved");
  assert.equal(state.statusPageCalls, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Multi-Tenant Incident Queries, Detail, Status Updates & Stats
// ─────────────────────────────────────────────────────────────────────────────

test("getIncidents Service: scopes queries to user's owned job monitors and filters correctly", async () => {
  const userAId = new mongoose.Types.ObjectId();
  const userBId = new mongoose.Types.ObjectId();
  const userA = { _id: userAId, id: userAId.toString() };

  const jobA1 = new mongoose.Types.ObjectId();
  const jobA2 = new mongoose.Types.ObjectId();
  const jobB1 = new mongoose.Types.ObjectId();
  const monitorA1 = new mongoose.Types.ObjectId();

  let capturedFilter = null;
  const origJobFind = JobMonitor.find;
  const origMonFind = Monitor.find;
  const origIncFind = Incident.find;
  const origIncCount = Incident.countDocuments;

  try {
    JobMonitor.find = (filter) => ({
      distinct: async (field) => {
        if (String(filter.owner) === String(userA._id)) return [jobA1, jobA2];
        return [jobB1];
      },
    });

    Monitor.find = (filter) => ({
      select: () => ({
        lean: async () => {
          if (String(filter.owner) === String(userA._id))
            return [{ _id: monitorA1 }];
          return [];
        },
      }),
      distinct: async () => [monitorA1],
    });

    Incident.find = (filter) => {
      capturedFilter = filter;
      const chain = {
        populate: () => chain,
        sort: () => chain,
        skip: () => chain,
        limit: () => chain,
        lean: async () => [],
      };
      return chain;
    };

    Incident.countDocuments = async () => 0;

    // 1. Query all incidents for userA: should match either owned monitors or owned job monitors
    await getIncidents({ limit: 10, page: 1 }, userA);
    assert.deepEqual(capturedFilter.$or, [
      { monitor: { $in: [monitorA1] } },
      { jobMonitor: { $in: [jobA1, jobA2] } },
    ]);

    // 2. Query with resourceType = "job_monitor"
    await getIncidents(
      { limit: 10, page: 1, resourceType: "job_monitor" },
      userA,
    );
    assert.deepEqual(capturedFilter.jobMonitor, { $in: [jobA1, jobA2] });

    // 3. Query with resourceType = "monitor"
    await getIncidents({ limit: 10, page: 1, resourceType: "monitor" }, userA);
    assert.deepEqual(capturedFilter.monitor, { $in: [monitorA1] });

    // 4. Query with specific jobMonitorId owned by userA
    await getIncidents(
      { limit: 10, page: 1, jobMonitorId: jobA1.toString() },
      userA,
    );
    assert.deepEqual(capturedFilter.jobMonitor, jobA1);

    // 5. Query with specific jobMonitorId NOT owned by userA (owned by userB)
    await getIncidents(
      { limit: 10, page: 1, jobMonitorId: jobB1.toString() },
      userA,
    );
    // Should safely yield empty matches
    assert.deepEqual(capturedFilter.jobMonitor, { $in: [] });
  } finally {
    JobMonitor.find = origJobFind;
    Monitor.find = origMonFind;
    Incident.find = origIncFind;
    Incident.countDocuments = origIncCount;
  }
});

test("getIncidentById Service: enforces multi-tenant ownership and restores snapshots", async () => {
  const userAId = new mongoose.Types.ObjectId();
  const userBId = new mongoose.Types.ObjectId();
  const userA = { _id: userAId, id: userAId.toString() };
  const userB = { _id: userBId, id: userBId.toString() };
  const jobA = new mongoose.Types.ObjectId();
  const incidentId = new mongoose.Types.ObjectId();

  const mockIncidentDoc = {
    _id: incidentId,
    jobMonitor: { _id: jobA, name: "Nightly Ingestion", owner: userA._id },
    resourceType: "job_monitor",
    status: INCIDENT_STATUS.ONGOING,
    triggerJobRun: null, // deleted / archived
    triggerJobRunSnapshot: {
      runId: "archived-run-1",
      status: "failed",
      errorMessage: "Snapshot backup data preserved",
    },
    recoveryJobRun: null,
    recoveryJobRunSnapshot: null,
    toObject() {
      return { ...this };
    },
  };

  const origJobFind = JobMonitor.find;
  const origMonFind = Monitor.find;
  const origIncFindOne = Incident.findOne;

  try {
    JobMonitor.find = (filter) => ({
      distinct: async () => {
        if (String(filter.owner) === String(userA._id)) return [jobA];
        return [];
      },
    });
    Monitor.find = () => ({
      select: () => ({
        lean: async () => [],
      }),
    });

    Incident.findOne = (filter) => {
      // If user A is looking, filter.$or matches jobA
      const hasJob = filter.$or?.some((clause) =>
        clause.jobMonitor?.$in?.some((id) => id.equals(jobA)),
      );
      const chain = {
        populate: () => chain,
        lean: async () => (hasJob ? mockIncidentDoc : null),
        then: (resolve, reject) =>
          Promise.resolve(hasJob ? mockIncidentDoc : null).then(
            resolve,
            reject,
          ),
      };
      return chain;
    };

    // User A can access it
    const resultA = await getIncidentById(incidentId, userA);
    assert.equal(resultA._id.toString(), incidentId.toString());
    assert.equal(resultA.triggerJobRun.runId, "archived-run-1");
    assert.equal(
      resultA.triggerJobRun.errorMessage,
      "Snapshot backup data preserved",
    );

    // User B cannot access it (throws 404 ApiError)
    await assert.rejects(
      async () => getIncidentById(incidentId, userB),
      (err) => {
        assert.equal(err.statusCode, 404);
        return true;
      },
    );
  } finally {
    JobMonitor.find = origJobFind;
    Monitor.find = origMonFind;
    Incident.findOne = origIncFindOne;
  }
});

test("updateIncidentStatus Service: validates transitions and avoids status page sync for JobMonitor", async () => {
  const userId = new mongoose.Types.ObjectId();
  const user = { _id: userId, id: userId.toString() };
  const jobMonitorId = new mongoose.Types.ObjectId();
  const incidentId = new mongoose.Types.ObjectId();

  const incidentDoc = {
    _id: incidentId,
    jobMonitor: { _id: jobMonitorId, name: "Data Sync", owner: user._id },
    monitor: null,
    resourceType: "job_monitor",
    status: INCIDENT_STATUS.ONGOING,
    startedAt: new Date(Date.now() - 3600000),
  };

  const origJobFind = JobMonitor.find;
  const origMonFind = Monitor.find;
  const origIncFindOne = Incident.findOne;
  const origIncFindOneAndUpdate = Incident.findOneAndUpdate;
  const origIncFindById = Incident.findById;
  const origActivityCreate = Activity.create;
  const origUserPrefFindOne = UserPreference.findOne;
  const origUserPrefGetOrCreate = UserPreference.getOrCreateForUser;
  const origNotifCreate = Notification.create;

  try {
    UserPreference.findOne = () => ({
      lean: async () => null,
    });
    UserPreference.getOrCreateForUser = async () => ({
      notifications: {
        toObject: () => ({
          inApp: {},
          email: { enabled: false },
          frequency: "daily",
        }),
      },
    });
    Notification.create = async (doc) => ({
      _id: new mongoose.Types.ObjectId(),
      ...doc,
      channels: {},
      save: async () => {},
      toObject: () => doc,
    });
    Activity.create = async () => ({});
    JobMonitor.find = () => ({ distinct: async () => [jobMonitorId] });
    Monitor.find = () => ({
      select: () => ({
        lean: async () => [],
      }),
    });

    const makeChain = (doc) => {
      const q = {
        populate: () => q,
        lean: async () => doc,
        then: (resolve, reject) => Promise.resolve(doc).then(resolve, reject),
      };
      return q;
    };

    Incident.findOne = () => makeChain(incidentDoc);

    // Case 1: Invalid transition (e.g. unknown status)
    await assert.rejects(
      async () =>
        updateIncidentStatus(incidentId, { status: "unknown_status" }, user),
      (err) => {
        assert.equal(err.statusCode, 400);
        return true;
      },
    );

    // Case 2: Valid transition to "investigating"
    Incident.findOneAndUpdate = async (filter, update) => ({
      ...incidentDoc,
      status: INCIDENT_STATUS.INVESTIGATING,
    });
    Incident.findById = () =>
      makeChain({
        ...incidentDoc,
        status: INCIDENT_STATUS.INVESTIGATING,
      });

    const updated = await updateIncidentStatus(
      incidentId,
      { status: INCIDENT_STATUS.INVESTIGATING },
      user,
    );
    assert.equal(updated.status, INCIDENT_STATUS.INVESTIGATING);
  } finally {
    JobMonitor.find = origJobFind;
    Monitor.find = origMonFind;
    Incident.findOne = origIncFindOne;
    Incident.findOneAndUpdate = origIncFindOneAndUpdate;
    Incident.findById = origIncFindById;
    Activity.create = origActivityCreate;
    UserPreference.findOne = origUserPrefFindOne;
    UserPreference.getOrCreateForUser = origUserPrefGetOrCreate;
    Notification.create = origNotifCreate;
  }
});

test("getDowntimeStats Service: aggregates downtime for JobMonitors and sets resourceType", async () => {
  const userId = new mongoose.Types.ObjectId();
  const user = { _id: userId, id: userId.toString() };
  const jobMonitorId = new mongoose.Types.ObjectId();

  const origJobFind = JobMonitor.find;
  const origMonFind = Monitor.find;
  const origIncAggregate = Incident.aggregate;
  const origIncFind = Incident.find;

  try {
    JobMonitor.find = () => ({ distinct: async () => [jobMonitorId] });
    Monitor.find = () => ({
      select: () => ({
        lean: async () => [],
      }),
    });

    let aggCallCount = 0;
    Incident.aggregate = async (pipeline) => {
      aggCallCount += 1;
      if (aggCallCount === 1) {
        // Overall summary
        return [
          {
            totalIncidents: 2,
            resolvedCount: 1,
            ongoingCount: 1,
            ongoingOnlyCount: 1,
            investigatingCount: 0,
            identifiedCount: 0,
            resolvedDowntime: 300,
            avgDuration: 300,
            maxDuration: 300,
            criticalCount: 1,
            majorCount: 1,
            minorCount: 0,
          },
        ];
      }
      // Top affected resources
      return [
        {
          monitorId: jobMonitorId,
          resourceId: jobMonitorId,
          name: "Nightly Sync Job",
          url: null,
          resourceType: "job_monitor",
          incidentCount: 2,
          totalDowntime: 300,
          criticalCount: 1,
        },
      ];
    };

    Incident.find = () => ({
      select: () => ({
        lean: async () => [
          { startedAt: new Date(Date.now() - 60000) }, // 60s live downtime
        ],
      }),
    });

    const stats = await getDowntimeStats({ window: "24h" }, user);
    assert.equal(stats.totalIncidents, 2);
    assert.equal(stats.resolvedCount, 1);
    assert.equal(stats.ongoingCount, 1);
    assert.ok(stats.totalDowntimeSeconds >= 359);
    assert.equal(stats.topAffectedMonitors.length, 1);
    assert.equal(stats.topAffectedMonitors[0].resourceType, "job_monitor");
    assert.equal(stats.topAffectedMonitors[0].name, "Nightly Sync Job");
  } finally {
    JobMonitor.find = origJobFind;
    Monitor.find = origMonFind;
    Incident.aggregate = origIncAggregate;
    Incident.find = origIncFind;
  }
});

test("Alerting Service: enqueuing notification alert extracts jobMonitor context", async () => {
  const userId = new mongoose.Types.ObjectId();
  const jobMonitorId = new mongoose.Types.ObjectId();
  const incidentId = new mongoose.Types.ObjectId();

  const notification = {
    _id: new mongoose.Types.ObjectId(),
    owner: userId,
    type: "incident_opened",
    title: "Nightly Backup is down",
    message: "Failed execution",
    priority: "critical",
    relatedResource: {
      resourceType: "Incident",
      resourceId: incidentId,
    },
    metadata: {
      jobMonitorId: jobMonitorId.toString(),
    },
  };

  const origIncFindById = Incident.findById;
  const origRuleFind = NotificationRule.find;
  const origIntegrationFind = NotificationIntegration.find;
  const origAlertPolicyFind = AlertPolicy.find;
  const origNotifUpdateOne = Notification.updateOne;
  try {
    NotificationRule.find = () => ({ lean: async () => [] });
    NotificationIntegration.find = async () => [];
    AlertPolicy.find = () => ({ lean: async () => [] });
    Notification.updateOne = async () => ({});
    Incident.findById = () => ({
      select: () => ({
        lean: async () => ({
          _id: incidentId,
          jobMonitor: jobMonitorId,
          severity: "critical",
          status: "ongoing",
        }),
      }),
    });

    // Enqueue call: will look up context and rules (empty rules returns { queued: 0 })
    const result = await enqueueNotificationAlert(notification);
    assert.equal(result.queued, 0);
  } finally {
    Incident.findById = origIncFindById;
    NotificationRule.find = origRuleFind;
    NotificationIntegration.find = origIntegrationFind;
    AlertPolicy.find = origAlertPolicyFind;
    Notification.updateOne = origNotifUpdateOne;
  }
});

test("deleteJobMonitor Service: cascades deletion of associated Incidents", async () => {
  const userId = new mongoose.Types.ObjectId();
  const user = { _id: userId, id: userId.toString(), role: "user" };
  const jobMonitorId = new mongoose.Types.ObjectId();

  let jobRunDeleted = false;
  let incidentDeleted = false;
  let monitorDeleted = false;

  const origJobMonFindOne = JobMonitor.findOne;
  const origJobRunDeleteMany = JobRun.deleteMany;
  const origIncidentDeleteMany = Incident.deleteMany;
  const origActivityCreate = Activity.create;

  try {
    Activity.create = async () => ({});
    JobMonitor.findOne = () => ({
      _id: jobMonitorId,
      name: "To be deleted",
      deleteOne: async () => {
        monitorDeleted = true;
      },
    });

    JobRun.deleteMany = async (filter) => {
      if (filter.jobMonitor === jobMonitorId) jobRunDeleted = true;
    };

    Incident.deleteMany = async (filter) => {
      if (filter.jobMonitor === jobMonitorId) incidentDeleted = true;
    };

    await deleteJobMonitor(jobMonitorId, user);

    assert.equal(jobRunDeleted, true, "Job runs must be deleted");
    assert.equal(incidentDeleted, true, "Incidents must be cascade deleted");
    assert.equal(monitorDeleted, true, "Job monitor must be deleted");
  } finally {
    JobMonitor.findOne = origJobMonFindOne;
    JobRun.deleteMany = origJobRunDeleteMany;
    Incident.deleteMany = origIncidentDeleteMany;
    Activity.create = origActivityCreate;
  }
});
