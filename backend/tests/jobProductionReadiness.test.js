import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { pruneJobRuns } from "../src/workers/retentionManager.js";
import { jobHeartbeatAuth } from "../src/middlewares/jobHeartbeatAuth.js";
import {
  rotateJobMonitorToken,
  getJobMonitors,
} from "../src/services/jobMonitor.service.js";
import { generateJobToken, hashJobToken } from "../src/services/jobSchedule.service.js";
import JobMonitor from "../src/models/JobMonitor.js";
import JobRun from "../src/models/JobRun.js";
import Incident from "../src/models/Incident.js";
import Activity from "../src/models/Activity.js";
import { JOB_STATUS, JOB_RUN_STATUS, ROLES } from "../src/config/constants.js";

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
// 1. Job Run Retention & Incident Protection
// ─────────────────────────────────────────────────────────────────────────────
test("Job Retention: pruneJobRuns preserves recent runs and snapshots incident refs before deletion", async () => {
  const jobMonitorId = new mongoose.Types.ObjectId();
  const runIds = ["run-old-1", "run-old-2", "run-old-3", "run-active-trigger"];

  const candidateRuns = runIds.map((id, index) => ({
    _id: id,
    status: JOB_RUN_STATUS.FAILED,
    runId: `run_${index}`,
    errorMessage: `Error in ${id}`,
    createdAt: new Date(Date.now() - 40 * 86_400_000),
  }));

  let deletedIds = [];
  let updatedIncidents = [];

  const fakeJobRun = {
    find(filter) {
      assert.equal(String(filter.jobMonitor), String(jobMonitorId));
      assert.ok(filter.createdAt.$lt instanceof Date);
      return query(candidateRuns);
    },
    async deleteMany(filter) {
      deletedIds = filter._id.$in;
      return { deletedCount: deletedIds.length };
    },
  };

  const fakeIncident = {
    find(filter) {
      assert.equal(filter.$or.length, 2);
      return query([
        {
          _id: "incident-resolved",
          status: "resolved",
          triggerJobRun: "run-old-1",
          recoveryJobRun: "run-old-2",
        },
        {
          _id: "incident-active",
          status: "ongoing",
          triggerJobRun: "run-active-trigger",
        },
      ]);
    },
    async updateOne(filter, update) {
      updatedIncidents.push({ filter, update });
      return { modifiedCount: 1 };
    },
  };

  const deletedCount = await pruneJobRuns(jobMonitorId, {
    JobRun: fakeJobRun,
    Incident: fakeIncident,
    cutoff: new Date(Date.now() - 30 * 86_400_000),
    batchSize: 10,
    keep: 0,
  });

  // Verify snapshots were saved on incidents
  assert.equal(updatedIncidents.length, 2);
  assert.ok(updatedIncidents[0].update.$set.triggerJobRunSnapshot);
  assert.ok(updatedIncidents[0].update.$set.recoveryJobRunSnapshot);

  // Active incident's triggerJobRun ('run-active-trigger') is protected!
  assert.ok(!deletedIds.includes("run-active-trigger"));
  assert.ok(deletedIds.includes("run-old-1"));
  assert.ok(deletedIds.includes("run-old-2"));
  assert.ok(deletedIds.includes("run-old-3"));
  assert.equal(deletedCount, 3);
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Token Grace Window Expiration (15 minutes)
// ─────────────────────────────────────────────────────────────────────────────
test("Token Security: jobHeartbeatAuth rejects previous token after 15-minute grace period expires", async () => {
  const monitorId = new mongoose.Types.ObjectId();
  const oldTokenData = generateJobToken();
  const newTokenData = generateJobToken();

  // Expired rotation timestamp (20 minutes ago)
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
    assert.match(errorCaught.message, /invalid authentication token/i);
  } finally {
    JobMonitor.findById = originalFindById;
  }
});

test("Token Security: jobHeartbeatAuth accepts previous token within 15-minute grace period", async () => {
  const monitorId = new mongoose.Types.ObjectId();
  const oldTokenData = generateJobToken();
  const newTokenData = generateJobToken();

  // Fresh rotation timestamp (5 minutes ago)
  const freshRotatedAt = new Date(Date.now() - 5 * 60 * 1000);

  const fakeMonitorDoc = {
    _id: monitorId,
    tokenPrefix: newTokenData.prefix,
    tokenHash: newTokenData.tokenHash,
    previousTokenHash: oldTokenData.tokenHash,
    tokenRotatedAt: freshRotatedAt,
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

    assert.equal(errorCaught, undefined);
    assert.equal(req.jobMonitor._id, monitorId);
  } finally {
    JobMonitor.findById = originalFindById;
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Immediate Token Revocation
// ─────────────────────────────────────────────────────────────────────────────
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
    // previousTokenHash must be null (no grace period)
    assert.equal(fakeMonitorDoc.previousTokenHash, null);
  } finally {
    JobMonitor.findOne = originalFindOne;
    Activity.create = originalActivityCreate;
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Schedule Type Filtering in Query Listing
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
