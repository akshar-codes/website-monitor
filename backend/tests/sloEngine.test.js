import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import express from "express";
import mongoose from "mongoose";
import Slo from "../src/models/Slo.js";
import Monitor from "../src/models/Monitor.js";
import Activity from "../src/models/Activity.js";
import {
  createSloSchema,
  updateSloSchema,
  listSlosSchema,
} from "../src/validators/slo.validator.js";
import {
  assertSloAllowed,
  assertRollingWindowAllowedForPlan,
  countOwnedSlos,
  createSlo,
  getSlos,
  getSloById,
  updateSlo,
  deleteSlo,
} from "../src/services/slo.service.js";
import { PLAN_DEFINITIONS, getPlanDefinition } from "../src/config/plans.js";
import { PLANS, ROLES } from "../src/config/constants.js";
import { FEATURES, hasFeature } from "../src/config/features.js";
import { getSloLimit, hasUnlimitedSlos } from "../src/utils/planUtils.js";

// Setup test environment variables
Object.assign(process.env, {
  NODE_ENV: "test",
  MONGO_URI: "mongodb://127.0.0.1:27099/site-watch-tests",
  COOKIE_SECRET: "test-cookie-secret-with-more-than-thirty-two-characters",
  SESSION_SECRET: "test-session-secret-with-more-than-thirty-two-characters",
});

const userAId = "64b000000000000000000010";
const userBId = "64b000000000000000000020";
const monitorAId = "64b000000000000000000030";
const monitorBId = "64b000000000000000000040";

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
});

const request = (path, { role, userId, plan, method = "GET", body } = {}) =>
  fetch(`${baseUrl}/api${path}`, {
    method,
    headers: {
      ...(role ? { "x-test-role": role } : {}),
      ...(userId ? { "x-test-user-id": userId } : {}),
      ...(plan ? { "x-test-plan": plan } : {}),
      ...(body ? { "content-type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

// ─────────────────────────────────────────────────────────────────────────────
// Unit Tests: Model & Virtuals
// ─────────────────────────────────────────────────────────────────────────────

test("SLO Model: virtual calculations and allowed downtime", () => {
  const slo = new Slo({
    owner: new mongoose.Types.ObjectId(userAId),
    monitor: new mongoose.Types.ObjectId(monitorAId),
    name: "Production 99.9% Uptime",
    targetPercentage: 99.9,
    rollingWindow: "30d",
    evaluationInterval: "1h",
    audit: { createdBy: new mongoose.Types.ObjectId(userAId) },
  });

  assert.equal(slo.rollingWindowDays, 30);
  assert.equal(slo.rollingWindowMs, 30 * 24 * 60 * 60 * 1000);
  assert.equal(slo.evaluationIntervalSeconds, 3600);
  // (1 - 0.999) * 30 days * 1440 min/day = 0.001 * 43200 = 43.2 minutes
  assert.equal(slo.allowedDowntimeMinutes, 43.2);

  const slo7d = new Slo({
    owner: new mongoose.Types.ObjectId(userAId),
    monitor: new mongoose.Types.ObjectId(monitorAId),
    name: "Weekly 99%",
    targetPercentage: 99.0,
    rollingWindow: "7d",
    evaluationInterval: "15m",
    audit: { createdBy: new mongoose.Types.ObjectId(userAId) },
  });

  assert.equal(slo7d.rollingWindowDays, 7);
  assert.equal(slo7d.evaluationIntervalSeconds, 900);
  // (1 - 0.99) * 7 days * 1440 min/day = 0.01 * 10080 = 100.8 minutes
  assert.equal(slo7d.allowedDowntimeMinutes, 100.8);
});

// ─────────────────────────────────────────────────────────────────────────────
// Unit Tests: Plan Entitlements & Subscription Enforcement
// ─────────────────────────────────────────────────────────────────────────────

test("SLO Plan Entitlements: centralized limits and feature checks", () => {
  assert.equal(getPlanDefinition(PLANS.FREE).limits.maxSlos, 0);
  assert.equal(hasFeature(PLANS.FREE, FEATURES.SLO_MANAGEMENT), false);
  assert.equal(getSloLimit(PLANS.FREE), 0);
  assert.equal(hasUnlimitedSlos(PLANS.FREE), false);

  assert.equal(getPlanDefinition(PLANS.PRO).limits.maxSlos, 5);
  assert.equal(hasFeature(PLANS.PRO, FEATURES.SLO_MANAGEMENT), true);
  assert.equal(getSloLimit(PLANS.PRO), 5);
  assert.equal(hasUnlimitedSlos(PLANS.PRO), false);

  assert.equal(getPlanDefinition(PLANS.UNLIMITED).limits.maxSlos, null);
  assert.equal(hasFeature(PLANS.UNLIMITED, FEATURES.SLO_MANAGEMENT), true);
  assert.equal(getSloLimit(PLANS.UNLIMITED), null);
  assert.equal(hasUnlimitedSlos(PLANS.UNLIMITED), true);
});

test("SLO Plan Enforcement: assertSloAllowed and data retention checks", async () => {
  // Free tier rejection (feature restricted)
  await assert.rejects(
    assertSloAllowed({ id: userAId, plan: PLANS.FREE }),
    (error) => {
      assert.equal(error.statusCode, 403);
      assert.equal(error.code, "FEATURE_RESTRICTED");
      return true;
    },
  );

  // Pro tier at limit rejection (upgrade required)
  await assert.rejects(
    assertSloAllowed(
      { id: userAId, plan: PLANS.PRO },
      undefined,
      async () => 5, // currently using 5
    ),
    (error) => {
      assert.equal(error.statusCode, 403);
      assert.equal(error.code, "UPGRADE_REQUIRED");
      return true;
    },
  );

  // Pro tier under limit allowed
  await assert.doesNotReject(
    assertSloAllowed(
      { id: userAId, plan: PLANS.PRO },
      undefined,
      async () => 4, // currently using 4 of 5
    ),
  );

  // Retention limit enforcement: Pro plan only retains 30 days
  assert.doesNotThrow(() =>
    assertRollingWindowAllowedForPlan(PLANS.PRO, "30d"),
  );
  assert.throws(
    () => assertRollingWindowAllowedForPlan(PLANS.PRO, "90d"),
    (error) => {
      assert.equal(error.statusCode, 403);
      assert.equal(error.code, "UPGRADE_REQUIRED");
      return true;
    },
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Unit Tests: Zod Validation
// ─────────────────────────────────────────────────────────────────────────────

test("SLO Validation: rejects invalid targets, windows, intervals, and malformed inputs", () => {
  // Target > 100
  assert.equal(
    createSloSchema.safeParse({
      name: "Invalid SLO",
      monitorId: monitorAId,
      targetPercentage: 105,
    }).success,
    false,
  );

  // Target < 50
  assert.equal(
    createSloSchema.safeParse({
      name: "Invalid SLO",
      monitorId: monitorAId,
      targetPercentage: 40,
    }).success,
    false,
  );

  // Target is not a number
  assert.equal(
    createSloSchema.safeParse({
      name: "Invalid SLO",
      monitorId: monitorAId,
      targetPercentage: "ninety-nine",
    }).success,
    false,
  );

  // Invalid rolling window
  assert.equal(
    createSloSchema.safeParse({
      name: "Invalid SLO",
      monitorId: monitorAId,
      targetPercentage: 99.9,
      rollingWindow: "45d",
    }).success,
    false,
  );

  // Invalid evaluation interval
  assert.equal(
    createSloSchema.safeParse({
      name: "Invalid SLO",
      monitorId: monitorAId,
      targetPercentage: 99.9,
      evaluationInterval: "10m",
    }).success,
    false,
  );

  // Valid schema parses with default alert settings & measurement contract
  const valid = createSloSchema.safeParse({
    name: "Valid Production API SLO",
    monitorId: monitorAId,
    targetPercentage: 99.9,
  });
  assert.equal(valid.success, true);
  assert.equal(valid.data.rollingWindow, "30d");
  assert.equal(valid.data.evaluationInterval, "1h");
  assert.equal(valid.data.enabled, true);
  assert.equal(valid.data.alertSettings.burnRateAlertsEnabled, true);
  assert.equal(
    valid.data.measurementContract.maxIntervalAttributionSeconds,
    3600,
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Integration Tests: Authorized CRUD, Tenant Authorization & Plan Limits
// ─────────────────────────────────────────────────────────────────────────────

test("SLO API: unauthenticated requests are rejected", async () => {
  const listRes = await request("/slos");
  assert.equal(listRes.status, 401);

  const createRes = await request("/slos", {
    method: "POST",
    body: {
      name: "SLO",
      monitorId: monitorAId,
      targetPercentage: 99.9,
    },
  });
  assert.equal(createRes.status, 401);
});

test("SLO API: administrators cannot create SLOs directly", async (t) => {
  t.mock.method(Monitor, "findById", async () => ({
    _id: monitorAId,
    owner: userAId,
  }));

  const res = await request("/slos", {
    role: ROLES.ADMIN,
    userId: "admin-id",
    method: "POST",
    body: {
      name: "Admin SLO",
      monitorId: monitorAId,
      targetPercentage: 99.9,
    },
  });

  // Admin role does not hold "slo:create" permission (or is blocked by service)
  assert.equal(res.status, 403);
});

test("SLO API: input validation rejects invalid targets and malformed payloads", async () => {
  // Target > 100
  const overRes = await request("/slos", {
    role: ROLES.USER,
    userId: userAId,
    method: "POST",
    body: {
      name: "API SLO",
      monitorId: monitorAId,
      targetPercentage: 105,
    },
  });
  assert.equal(overRes.status, 400);
  const overData = await overRes.json();
  assert.equal(overData.success, false);

  // Missing monitorId
  const missingMonRes = await request("/slos", {
    role: ROLES.USER,
    userId: userAId,
    method: "POST",
    body: {
      name: "API SLO",
      targetPercentage: 99.9,
    },
  });
  assert.equal(missingMonRes.status, 400);

  // Invalid ObjectId format
  const invalidIdRes = await request(`/slos/not-an-object-id`, {
    role: ROLES.USER,
    userId: userAId,
  });
  assert.equal(invalidIdRes.status, 400);
});

test("SLO API: creation rejects unauthorized monitor IDs and non-existent targets", async (t) => {
  t.mock.method(Slo, "countDocuments", async () => 0);

  // Non-existent monitor
  t.mock.method(Monitor, "findById", async () => null);

  const notFoundRes = await request("/slos", {
    role: ROLES.USER,
    userId: userAId,
    method: "POST",
    body: {
      name: "Non-existent Target SLO",
      monitorId: monitorAId,
      targetPercentage: 99.9,
    },
  });
  assert.equal(notFoundRes.status, 404);

  // Foreign monitor (owned by User B, requested by User A)
  t.mock.method(Monitor, "findById", async (id) => ({
    _id: id,
    owner: userBId, // Owned by User B!
  }));

  const forbiddenRes = await request("/slos", {
    role: ROLES.USER,
    userId: userAId, // User A is acting
    method: "POST",
    body: {
      name: "Foreign Monitor SLO",
      monitorId: monitorBId,
      targetPercentage: 99.9,
    },
  });
  assert.equal(forbiddenRes.status, 403);
  const forbiddenData = await forbiddenRes.json();
  assert.equal(forbiddenData.code, "OWNERSHIP_REQUIRED");
});

test("SLO API: plan limits block creation on Free tier and when Pro quota is exceeded", async (t) => {
  t.mock.method(Monitor, "findById", async (id) => ({
    _id: id,
    owner: userAId,
  }));

  // User on Free tier
  const freeRes = await request("/slos", {
    role: ROLES.USER,
    userId: userAId,
    plan: PLANS.FREE,
    method: "POST",
    body: {
      name: "Free Tier SLO",
      monitorId: monitorAId,
      targetPercentage: 99.9,
    },
  });
  assert.equal(freeRes.status, 403);
  const freeData = await freeRes.json();
  assert.equal(freeData.code, "FEATURE_RESTRICTED");

  // User on Pro tier already at quota (5)
  t.mock.method(Slo, "countDocuments", async () => 5);

  const quotaRes = await request("/slos", {
    role: ROLES.USER,
    userId: userAId,
    plan: PLANS.PRO,
    method: "POST",
    body: {
      name: "Pro Quota Exceeded SLO",
      monitorId: monitorAId,
      targetPercentage: 99.9,
    },
  });
  assert.equal(quotaRes.status, 403);
  const quotaData = await quotaRes.json();
  assert.equal(quotaData.code, "UPGRADE_REQUIRED");
});

test("SLO API: cross-tenant access is rejected for read, update, and delete", async (t) => {
  const foreignSlo = {
    _id: "64b000000000000000000099",
    owner: userBId, // Belongs to User B
    monitor: monitorBId,
    name: "User B SLO",
    targetPercentage: 99.9,
    rollingWindow: "30d",
    evaluationInterval: "1h",
    enabled: true,
    audit: { createdBy: userBId, changeHistory: [] },
  };

  t.mock.method(Slo, "findById", () => ({
    populate: async () => foreignSlo,
    ...foreignSlo,
  }));

  // User A tries to GET User B's SLO
  const getRes = await request(`/slos/${foreignSlo._id}`, {
    role: ROLES.USER,
    userId: userAId,
  });
  assert.equal(getRes.status, 403);
  assert.equal((await getRes.json()).code, "OWNERSHIP_REQUIRED");

  // User A tries to UPDATE User B's SLO
  const updateRes = await request(`/slos/${foreignSlo._id}`, {
    role: ROLES.USER,
    userId: userAId,
    method: "PUT",
    body: { targetPercentage: 99.5 },
  });
  assert.equal(updateRes.status, 403);
  assert.equal((await updateRes.json()).code, "OWNERSHIP_REQUIRED");

  // User A tries to DELETE User B's SLO
  const deleteRes = await request(`/slos/${foreignSlo._id}`, {
    role: ROLES.USER,
    userId: userAId,
    method: "DELETE",
  });
  assert.equal(deleteRes.status, 403);
  assert.equal((await deleteRes.json()).code, "OWNERSHIP_REQUIRED");
});

test("SLO API: authorized CRUD lifecycle with pagination and audit history", async (t) => {
  const inMemorySlos = new Map();
  let nextIdCounter = 1;

  // Mock Monitor lookup
  t.mock.method(Monitor, "findById", async (id) => ({
    _id: id,
    owner: userAId,
    name: "Production Gateway",
    url: "https://api.example.com",
    kind: "website",
    interval: 300,
  }));

  // Mock Slo.findOne for uniqueness check
  t.mock.method(Slo, "findOne", async (query) => {
    for (const slo of inMemorySlos.values()) {
      if (
        slo.owner.toString() === query.owner.toString() &&
        slo.monitor.toString() === query.monitor.toString() &&
        slo.name === query.name &&
        (!query._id || slo._id.toString() !== query._id.$ne?.toString())
      ) {
        return slo;
      }
    }
    return null;
  });

  // Mock Slo.create
  t.mock.method(Slo, "create", async (data) => {
    const id = `64b000000000000000000${String(nextIdCounter++).padStart(3, "0")}`;
    const doc = {
      _id: id,
      ...data,
      save: async function () {
        return this;
      },
      deleteOne: async function () {
        inMemorySlos.delete(id);
      },
    };
    inMemorySlos.set(id, doc);
    return doc;
  });

  // Mock Slo.countDocuments
  t.mock.method(Slo, "countDocuments", async (filter = {}) => {
    let count = 0;
    for (const slo of inMemorySlos.values()) {
      if (!filter.owner || slo.owner.toString() === filter.owner.toString()) {
        count++;
      }
    }
    return count;
  });

  // Mock Slo.find
  t.mock.method(Slo, "find", (filter = {}) => {
    let items = Array.from(inMemorySlos.values()).filter(
      (s) => !filter.owner || s.owner.toString() === filter.owner.toString(),
    );
    return {
      populate() {
        return this;
      },
      sort() {
        return this;
      },
      skip(n) {
        items = items.slice(n);
        return this;
      },
      limit(n) {
        items = items.slice(0, n);
        return Promise.resolve(items);
      },
    };
  });

  // Mock Slo.findById
  t.mock.method(Slo, "findById", (id) => {
    const doc = inMemorySlos.get(id.toString());
    if (!doc) {
      return {
        populate: async () => null,
      };
    }
    return {
      populate: async () => doc,
      ...doc,
      save: async function () {
        inMemorySlos.set(id.toString(), this);
        return this;
      },
      deleteOne: async function () {
        inMemorySlos.delete(id.toString());
      },
    };
  });

  // 1. Create SLO
  const createRes = await request("/slos", {
    role: ROLES.USER,
    userId: userAId,
    method: "POST",
    body: {
      name: "API Gateway 99.9% Availability",
      description: "Availability SLO for production API",
      monitorId: monitorAId,
      targetPercentage: 99.9,
      rollingWindow: "30d",
      evaluationInterval: "1h",
      alertSettings: {
        burnRateAlertsEnabled: true,
        burnRateThresholds: [
          { window: "1h", rate: 14.4, severity: "critical" },
          { window: "6h", rate: 6.0, severity: "high" },
        ],
        budgetExhaustedAlert: true,
        budgetWarningThresholdPercent: 20,
      },
    },
  });

  assert.equal(createRes.status, 201);
  const createdBody = await createRes.json();
  assert.equal(createdBody.success, true);
  const createdSlo = createdBody.data;
  assert.equal(createdSlo.name, "API Gateway 99.9% Availability");
  assert.equal(createdSlo.targetPercentage, 99.9);
  assert.equal(createdSlo.audit.createdBy, userAId);
  assert.equal(createdSlo.audit.changeHistory.length, 1);
  assert.equal(createdSlo.audit.changeHistory[0].action, "created");

  // 2. Duplicate Name Rejection on Same Monitor
  const duplicateRes = await request("/slos", {
    role: ROLES.USER,
    userId: userAId,
    method: "POST",
    body: {
      name: "API Gateway 99.9% Availability",
      monitorId: monitorAId,
      targetPercentage: 99.5,
    },
  });
  assert.equal(duplicateRes.status, 409);

  // 3. List SLOs (paginated)
  const listRes = await request("/slos?page=1&limit=10", {
    role: ROLES.USER,
    userId: userAId,
  });
  assert.equal(listRes.status, 200);
  const listBody = await listRes.json();
  assert.equal(listBody.success, true);
  assert.equal(listBody.data.length, 1);
  assert.equal(listBody.pagination.page, 1);
  assert.equal(listBody.pagination.limit, 10);
  assert.equal(listBody.pagination.total, 1);

  // 4. Get SLO by ID
  const getRes = await request(`/slos/${createdSlo._id}`, {
    role: ROLES.USER,
    userId: userAId,
  });
  assert.equal(getRes.status, 200);
  const getBody = await getRes.json();
  assert.equal(getBody.data._id, createdSlo._id);

  // 5. Update SLO with audit diff & reason
  const updateRes = await request(`/slos/${createdSlo._id}`, {
    role: ROLES.USER,
    userId: userAId,
    method: "PUT",
    body: {
      targetPercentage: 99.95,
      changeReason: "Tightening SLA for Q4 enterprise customer commitment",
    },
  });
  assert.equal(updateRes.status, 200);
  const updateBody = await updateRes.json();
  assert.equal(updateBody.data.targetPercentage, 99.95);
  assert.equal(updateBody.data.audit.changeHistory.length, 2);
  const latestAudit = updateBody.data.audit.changeHistory[1];
  assert.equal(latestAudit.action, "updated");
  assert.equal(
    latestAudit.reason,
    "Tightening SLA for Q4 enterprise customer commitment",
  );
  assert.deepEqual(latestAudit.diff.targetPercentage, {
    from: 99.9,
    to: 99.95,
  });

  // 6. Delete SLO
  const deleteRes = await request(`/slos/${createdSlo._id}`, {
    role: ROLES.USER,
    userId: userAId,
    method: "DELETE",
  });
  assert.equal(deleteRes.status, 200);
  assert.equal((await deleteRes.json()).success, true);
  assert.equal(inMemorySlos.size, 0);
});
