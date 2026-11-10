import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import mongoose from "mongoose";
import Activity from "../src/models/Activity.js";
import JobMonitor from "../src/models/JobMonitor.js";
import JobRun from "../src/models/JobRun.js";
import {
  ROLES,
  PLANS,
  JOB_STATUS,
  JOB_RUN_STATUS,
} from "../src/config/constants.js";
import {
  generateJobToken,
  hashJobToken,
} from "../src/services/jobSchedule.service.js";

// Setup test environment variables
Object.assign(process.env, {
  NODE_ENV: "test",
  MONGO_URI: "mongodb://127.0.0.1:27099/site-watch-tests",
  COOKIE_SECRET: "test-cookie-secret-with-more-than-thirty-two-characters",
  SESSION_SECRET: "test-session-secret-with-more-than-thirty-two-characters",
});

const userAId = "64b0000000000000000000a1";
const userBId = "64b0000000000000000000b2";

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
      const plan = req.get("x-test-plan") || (role === "admin" ? null : "pro");
      req.user = {
        id,
        _id: id,
        role,
        active: true,
        plan,
        planStatus: role === "admin" ? null : "active",
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
  { role, userId, plan, token, method = "GET", body } = {},
) =>
  fetch(`${baseUrl}/api${path}`, {
    method,
    headers: {
      ...(role ? { "x-test-role": role } : {}),
      ...(userId ? { "x-test-user-id": userId } : {}),
      ...(plan ? { "x-test-plan": plan } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

// ─────────────────────────────────────────────────────────────────────────────
// 1. Job Monitor Management CRUD & Token Security
// ─────────────────────────────────────────────────────────────────────────────

test("Job Monitor Management API: rejects unauthenticated requests", async () => {
  const listRes = await request("/job-monitors");
  assert.equal(listRes.status, 401);

  const createRes = await request("/job-monitors", {
    method: "POST",
    body: { name: "Backup", scheduleType: "interval", intervalSeconds: 300 },
  });
  assert.equal(createRes.status, 401);
});

test("Job Monitor Management API: administrators cannot create job monitors directly", async () => {
  const res = await request("/job-monitors", {
    role: ROLES.ADMIN,
    userId: "admin-id",
    method: "POST",
    body: {
      name: "Admin Backup",
      scheduleType: "interval",
      intervalSeconds: 300,
    },
  });

  assert.equal(res.status, 403);
  const data = await res.json();
  assert.equal(data.success, false);
});

test("Job Monitor Management API: creates monitor, returns token once, and redacts hash in queries", async (t) => {
  const monitorId = new mongoose.Types.ObjectId();
  const tokenData = generateJobToken();

  const fakeMonitorDoc = {
    _id: monitorId,
    owner: userAId,
    name: "Nightly Sync",
    scheduleType: "interval",
    intervalSeconds: 600,
    timezone: "UTC",
    status: JOB_STATUS.PENDING,
    active: true,
    tokenPrefix: tokenData.prefix,
    tokenHash: tokenData.tokenHash,
    scheduleDisplay: "Every 10 minutes",
    toJSON() {
      return {
        id: String(monitorId),
        name: "Nightly Sync",
        scheduleType: "interval",
        intervalSeconds: 600,
        tokenPrefix: tokenData.prefix,
        status: JOB_STATUS.PENDING,
        active: true,
      };
    },
    toObject() {
      return this.toJSON();
    },
  };

  t.mock.method(JobMonitor, "countDocuments", async () => 0);
  t.mock.method(JobMonitor, "create", async () => fakeMonitorDoc);

  const createRes = await request("/job-monitors", {
    role: ROLES.USER,
    userId: userAId,
    method: "POST",
    body: {
      name: "Nightly Sync",
      scheduleType: "interval",
      intervalSeconds: 600,
    },
  });

  assert.equal(createRes.status, 201);
  const createData = await createRes.json();
  assert.equal(createData.success, true);
  assert.ok(
    createData.data.token,
    "Plaintext token must be returned once on creation",
  );
  assert.match(createData.data.token, /^jm_live_/);
  assert.equal(
    createData.data.tokenHash,
    undefined,
    "tokenHash must never be exposed",
  );

  // Fetch single monitor later: verify token and tokenHash are absent
  t.mock.method(JobMonitor, "findOne", async () => fakeMonitorDoc);

  const getRes = await request(`/job-monitors/${monitorId}`, {
    role: ROLES.USER,
    userId: userAId,
  });

  assert.equal(getRes.status, 200);
  const getData = await getRes.json();
  assert.equal(getData.success, true);
  assert.equal(
    getData.data.token,
    undefined,
    "token must not be returned in GET",
  );
  assert.equal(
    getData.data.tokenHash,
    undefined,
    "tokenHash must not be returned in GET",
  );
  assert.equal(getData.data.tokenPrefix, tokenData.prefix);
});

test("Job Monitor Management API: rotates reporting token securely", async (t) => {
  const monitorId = new mongoose.Types.ObjectId();
  const oldTokenData = generateJobToken();

  const fakeMonitorDoc = {
    _id: monitorId,
    owner: userAId,
    name: "Nightly Sync",
    tokenPrefix: oldTokenData.prefix,
    tokenHash: oldTokenData.tokenHash,
    previousTokenHash: null,
    tokenRotatedAt: null,
    save: async () => fakeMonitorDoc,
  };

  t.mock.method(JobMonitor, "findOne", () => ({
    select: () => fakeMonitorDoc,
  }));

  const rotateRes = await request(`/job-monitors/${monitorId}/rotate-token`, {
    role: ROLES.USER,
    userId: userAId,
    method: "POST",
  });

  assert.equal(rotateRes.status, 200);
  const rotateData = await rotateRes.json();
  assert.equal(rotateData.success, true);
  assert.ok(
    rotateData.data.token,
    "New plaintext token returned upon rotation",
  );
  assert.notEqual(rotateData.data.tokenPrefix, oldTokenData.prefix);
  assert.equal(fakeMonitorDoc.previousTokenHash, oldTokenData.tokenHash);
});

test("Job Monitor Management API: enforces multi-tenant isolation", async (t) => {
  const monitorId = new mongoose.Types.ObjectId();

  // Job owned by User A
  t.mock.method(JobMonitor, "findOne", async (filter) => {
    if (filter.owner === userAId) {
      return { _id: monitorId, owner: userAId, name: "User A Monitor" };
    }
    return null; // Not found for User B
  });

  // User B tries to read User A's job monitor
  const res = await request(`/job-monitors/${monitorId}`, {
    role: ROLES.USER,
    userId: userBId,
  });

  assert.equal(res.status, 404);
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. External Heartbeat Reporting & Authentication
// ─────────────────────────────────────────────────────────────────────────────

test("Heartbeat API: authentication rejects missing or invalid tokens", async (t) => {
  const monitorId = new mongoose.Types.ObjectId();
  const tokenData = generateJobToken();

  const fakeMonitorDoc = {
    _id: monitorId,
    tokenPrefix: tokenData.prefix,
    tokenHash: tokenData.tokenHash,
    active: true,
    status: JOB_STATUS.UP,
  };

  t.mock.method(JobMonitor, "findById", () => ({
    select: async () => fakeMonitorDoc,
  }));

  // Missing Authorization header
  const noTokenRes = await request(`/job-heartbeats/${monitorId}`, {
    method: "POST",
    body: { event: "succeeded" },
  });
  assert.equal(noTokenRes.status, 401);

  // Invalid bearer token
  const badTokenRes = await request(`/job-heartbeats/${monitorId}`, {
    token: "jm_live_invalidtoken_12345",
    method: "POST",
    body: { event: "succeeded" },
  });
  assert.equal(badTokenRes.status, 401);

  // Invalid ObjectId format
  const badIdRes = await request("/job-heartbeats/not-an-id", {
    token: tokenData.token,
    method: "POST",
    body: { event: "succeeded" },
  });
  assert.equal(badIdRes.status, 400);
});

test("Heartbeat API: rejects reports for paused or inactive job monitors", async (t) => {
  const monitorId = new mongoose.Types.ObjectId();
  const tokenData = generateJobToken();

  const pausedDoc = {
    _id: monitorId,
    tokenPrefix: tokenData.prefix,
    tokenHash: tokenData.tokenHash,
    active: false,
    status: JOB_STATUS.PAUSED,
  };

  t.mock.method(JobMonitor, "findById", () => ({
    select: async () => pausedDoc,
  }));

  const res = await request(`/job-heartbeats/${monitorId}`, {
    token: tokenData.token,
    method: "POST",
    body: { event: "started", runId: "test-run-1" },
  });

  assert.equal(res.status, 409);
  const data = await res.json();
  assert.match(data.message, /paused or inactive/);
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Execution Lifecycle & Idempotency
// ─────────────────────────────────────────────────────────────────────────────

test("Heartbeat API: started event creates in-flight execution and duplicate is idempotent", async (t) => {
  const monitorId = new mongoose.Types.ObjectId();
  const tokenData = generateJobToken();

  let inFlightRun = null;

  const fakeMonitorDoc = {
    _id: monitorId,
    tokenPrefix: tokenData.prefix,
    tokenHash: tokenData.tokenHash,
    active: true,
    status: JOB_STATUS.PENDING,
    scheduleType: "interval",
    intervalSeconds: 300,
    gracePeriodSeconds: 60,
    runTimeoutSeconds: 3600,
    currentRunId: null,
    currentRunStartedAt: null,
    toObject() {
      return { ...this };
    },
    save: async () => fakeMonitorDoc,
  };

  t.mock.method(JobMonitor, "findById", () => ({
    select: async () => fakeMonitorDoc,
  }));

  t.mock.method(JobRun, "findOne", async ({ runId }) => {
    return inFlightRun && inFlightRun.runId === runId ? inFlightRun : null;
  });

  t.mock.method(JobRun, "create", async (payload) => {
    inFlightRun = {
      _id: new mongoose.Types.ObjectId(),
      ...payload,
      save: async () => inFlightRun,
    };
    return inFlightRun;
  });

  // 1. Initial "started" event
  const startRes = await request(`/job-heartbeats/${monitorId}`, {
    token: tokenData.token,
    method: "POST",
    body: {
      event: "started",
      runId: "run-cycle-100",
      metadata: { worker: "backup-host-01" },
    },
  });

  assert.equal(startRes.status, 201);
  const startData = await startRes.json();
  assert.equal(startData.data.status, JOB_RUN_STATUS.STARTED);
  assert.equal(startData.data.duplicate, false);
  assert.equal(fakeMonitorDoc.currentRunId, "run-cycle-100");

  // 2. Duplicate "started" event with the same runId (e.g. network retry)
  const dupStartRes = await request(`/job-heartbeats/${monitorId}`, {
    token: tokenData.token,
    method: "POST",
    body: {
      event: "started",
      runId: "run-cycle-100",
    },
  });

  assert.equal(dupStartRes.status, 200);
  const dupStartData = await dupStartRes.json();
  assert.equal(dupStartData.data.duplicate, true);
  assert.equal(dupStartData.data.status, JOB_RUN_STATUS.STARTED);
});

test("Heartbeat API: succeeded event transitions running execution and advances schedule", async (t) => {
  const monitorId = new mongoose.Types.ObjectId();
  const tokenData = generateJobToken();

  const startedAt = new Date(Date.now() - 45_000); // 45 seconds ago
  const inFlightRun = {
    _id: new mongoose.Types.ObjectId(),
    jobMonitor: monitorId,
    runId: "run-cycle-200",
    status: JOB_RUN_STATUS.STARTED,
    startedAt,
    durationMs: null,
    save: async () => inFlightRun,
  };

  const fakeMonitorDoc = {
    _id: monitorId,
    tokenPrefix: tokenData.prefix,
    tokenHash: tokenData.tokenHash,
    active: true,
    status: JOB_STATUS.PENDING,
    scheduleType: "interval",
    intervalSeconds: 600,
    currentRunId: "run-cycle-200",
    currentRunStartedAt: startedAt,
    consecutiveSuccesses: 0,
    consecutiveFailures: 2,
    toObject() {
      return { ...this };
    },
    save: async () => fakeMonitorDoc,
  };

  t.mock.method(JobMonitor, "findById", () => ({
    select: async () => fakeMonitorDoc,
  }));

  t.mock.method(JobRun, "findOne", async () => inFlightRun);

  const finishRes = await request(`/job-heartbeats/${monitorId}`, {
    token: tokenData.token,
    method: "POST",
    body: {
      event: "succeeded",
      runId: "run-cycle-200",
      output: "Backup saved: 2.4 GB",
    },
  });

  assert.equal(finishRes.status, 200);
  const finishData = await finishRes.json();
  assert.equal(finishData.data.status, JOB_RUN_STATUS.SUCCEEDED);
  assert.equal(finishData.data.duplicate, false);

  // Verify transitions
  assert.equal(inFlightRun.status, JOB_RUN_STATUS.SUCCEEDED);
  assert.ok(inFlightRun.durationMs >= 45_000);
  assert.equal(fakeMonitorDoc.status, JOB_STATUS.UP);
  assert.equal(fakeMonitorDoc.consecutiveSuccesses, 1);
  assert.equal(fakeMonitorDoc.consecutiveFailures, 0);
  assert.equal(fakeMonitorDoc.currentRunId, null);
  assert.ok(fakeMonitorDoc.nextExpectedAt instanceof Date);

  // 3. Duplicate "succeeded" event
  const dupFinishRes = await request(`/job-heartbeats/${monitorId}`, {
    token: tokenData.token,
    method: "POST",
    body: {
      event: "succeeded",
      runId: "run-cycle-200",
    },
  });

  assert.equal(dupFinishRes.status, 200);
  const dupFinishData = await dupFinishRes.json();
  assert.equal(dupFinishData.data.duplicate, true);
  assert.equal(dupFinishData.data.status, JOB_RUN_STATUS.SUCCEEDED);
});

test("Heartbeat API: single-ping execution without prior started event succeeds", async (t) => {
  const monitorId = new mongoose.Types.ObjectId();
  const tokenData = generateJobToken();

  let createdRun = null;

  const fakeMonitorDoc = {
    _id: monitorId,
    tokenPrefix: tokenData.prefix,
    tokenHash: tokenData.tokenHash,
    active: true,
    status: JOB_STATUS.PENDING,
    scheduleType: "cron",
    cronExpression: "0 2 * * *",
    timezone: "UTC",
    consecutiveSuccesses: 0,
    currentRunId: null,
    toObject() {
      return { ...this };
    },
    save: async () => fakeMonitorDoc,
  };

  t.mock.method(JobMonitor, "findById", () => ({
    select: async () => fakeMonitorDoc,
  }));

  t.mock.method(JobRun, "findOne", async () => null);

  t.mock.method(JobRun, "create", async (payload) => {
    createdRun = {
      _id: new mongoose.Types.ObjectId(),
      ...payload,
      save: async () => createdRun,
    };
    return createdRun;
  });

  // Client simply sends single-ping succeeded
  const res = await request(`/job-heartbeats/${monitorId}`, {
    token: tokenData.token,
    method: "POST",
    body: {
      event: "succeeded",
      durationMs: 3200,
      output: "Nightly export finished",
    },
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.data.status, JOB_RUN_STATUS.SUCCEEDED);
  assert.equal(data.data.durationMs, 3200);
  assert.ok(createdRun);
  assert.equal(createdRun.durationMs, 3200);
  assert.equal(fakeMonitorDoc.status, JOB_STATUS.UP);
});

test("Heartbeat API: rejects invalid transitions on terminal runs", async (t) => {
  const monitorId = new mongoose.Types.ObjectId();
  const tokenData = generateJobToken();

  const finalizedRun = {
    _id: new mongoose.Types.ObjectId(),
    jobMonitor: monitorId,
    runId: "run-terminal-1",
    status: JOB_RUN_STATUS.SUCCEEDED,
  };

  const fakeMonitorDoc = {
    _id: monitorId,
    tokenPrefix: tokenData.prefix,
    tokenHash: tokenData.tokenHash,
    active: true,
    status: JOB_STATUS.UP,
  };

  t.mock.method(JobMonitor, "findById", () => ({
    select: async () => fakeMonitorDoc,
  }));

  t.mock.method(JobRun, "findOne", async () => finalizedRun);

  // Attempting to send "started" for an already succeeded run
  const resStarted = await request(`/job-heartbeats/${monitorId}`, {
    token: tokenData.token,
    method: "POST",
    body: { event: "started", runId: "run-terminal-1" },
  });
  assert.equal(resStarted.status, 409);

  // Attempting to send "failed" for an already succeeded run
  const resFailed = await request(`/job-heartbeats/${monitorId}`, {
    token: tokenData.token,
    method: "POST",
    body: { event: "failed", runId: "run-terminal-1" },
  });
  assert.equal(resFailed.status, 409);
});

test("Heartbeat API: validates client timestamps against reasonable bounds", async (t) => {
  const monitorId = new mongoose.Types.ObjectId();
  const tokenData = generateJobToken();

  const fakeMonitorDoc = {
    _id: monitorId,
    tokenPrefix: tokenData.prefix,
    tokenHash: tokenData.tokenHash,
    active: true,
    status: JOB_STATUS.UP,
  };

  t.mock.method(JobMonitor, "findById", () => ({
    select: async () => fakeMonitorDoc,
  }));

  // Far future timestamp (e.g. 2 hours in the future)
  const farFuture = new Date(Date.now() + 2 * 3600 * 1000).toISOString();
  const resFuture = await request(`/job-heartbeats/${monitorId}`, {
    token: tokenData.token,
    method: "POST",
    body: { event: "started", startedAt: farFuture },
  });
  assert.equal(resFuture.status, 400);

  // completedAt preceding startedAt
  const resBackwards = await request(`/job-heartbeats/${monitorId}`, {
    token: tokenData.token,
    method: "POST",
    body: {
      event: "succeeded",
      startedAt: new Date(Date.now() - 1000).toISOString(),
      completedAt: new Date(Date.now() - 5000).toISOString(),
    },
  });
  assert.equal(resBackwards.status, 400);
});

test("Heartbeat API: supports previous token during rotation grace period", async (t) => {
  const monitorId = new mongoose.Types.ObjectId();
  const oldTokenData = generateJobToken();
  const newTokenData = generateJobToken();

  const fakeMonitorDoc = {
    _id: monitorId,
    tokenPrefix: newTokenData.prefix,
    tokenHash: newTokenData.tokenHash,
    previousTokenHash: oldTokenData.tokenHash, // Rotated, previous token saved
    active: true,
    status: JOB_STATUS.PENDING,
    scheduleType: "interval",
    intervalSeconds: 300,
    consecutiveSuccesses: 0,
    toObject() {
      return { ...this };
    },
    save: async () => fakeMonitorDoc,
  };

  t.mock.method(JobMonitor, "findById", () => ({
    select: async () => fakeMonitorDoc,
  }));

  t.mock.method(JobRun, "findOne", async () => null);
  t.mock.method(JobRun, "create", async (p) => ({ ...p, save: async () => p }));

  // Heartbeat using OLD token succeeds due to previousTokenHash grace
  const res = await request(`/job-heartbeats/${monitorId}`, {
    token: oldTokenData.token,
    method: "POST",
    body: { event: "succeeded", durationMs: 1200 },
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.data.status, JOB_RUN_STATUS.SUCCEEDED);
});
