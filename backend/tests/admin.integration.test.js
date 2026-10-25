import assert from "node:assert/strict";
import { after, before, test, mock } from "node:test";
import express from "express";
import mongoose from "mongoose";
import User from "../src/models/User.js";
import PlanUpgradeRequest from "../src/models/PlanUpgradeRequest.js";
import Activity from "../src/models/Activity.js";
import Monitor from "../src/models/Monitor.js";
import Incident from "../src/models/Incident.js";

// Use the real admin router and middleware while replacing only the session
// boundary. No database connection or production credentials are used.
Object.assign(process.env, {
  NODE_ENV: "test",
  MONGO_URI: "mongodb://127.0.0.1:27099/website-monitor-tests",
  CORS_ORIGIN: "http://localhost:5173",
  COOKIE_SECRET: "test-cookie-secret-with-more-than-thirty-two-characters",
  SESSION_SECRET: "test-session-secret-with-more-than-thirty-two-characters",
  CLIENT_URL: "http://localhost:5173",
  SMTP_HOST: "localhost",
  SMTP_USER: "test-user",
  SMTP_PASS: "test-password",
  SMTP_FROM_EMAIL: "test@example.com",
  RATE_LIMIT_MAX: "500",
  AUTH_RATE_LIMIT_MAX: "500",
});

const testUserId = "64b000000000000000000001";
const adminId = "64b000000000000000000002";
let server;
let baseUrl;
let app;
let authorize;
let adminService;
let upgradeService;
let adminOperations;
let auditService;

before(async () => {
  const [
    { default: routes },
    { default: errorHandler },
    authz,
    admin,
    upgrades,
    operations,
    audit,
  ] = await Promise.all([
    import("../src/routes/index.js"),
    import("../src/middlewares/errorHandler.js"),
    import("../src/middlewares/authorize.js"),
    import("../src/services/admin.service.js"),
    import("../src/services/planUpgradeRequest.service.js"),
    import("../src/services/adminOperations.service.js"),
    import("../src/services/adminAudit.service.js"),
  ]);
  authorize = authz.authorize;
  adminService = admin;
  upgradeService = upgrades;
  adminOperations = operations;
  auditService = audit;

  app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const role = req.get("x-test-role");
    req.isAuthenticated = () => Boolean(role);
    if (role) {
      const id = req.get("x-test-user-id") || testUserId;
      req.user = {
        id,
        _id: id,
        role,
        active: true,
        plan: role === "admin" ? null : "free",
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
  if (server)
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
});

const request = (path, { role, userId, method = "GET", body } = {}) =>
  fetch(`${baseUrl}/api${path}`, {
    method,
    headers: {
      ...(role ? { "x-test-role": role } : {}),
      ...(userId ? { "x-test-user-id": userId } : {}),
      ...(body ? { "content-type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

test("direct admin API requests require authentication and ADMIN role", async (t) => {
  await t.test("unauthenticated dashboard request is denied", async () => {
    const response = await request("/admin/dashboard");
    assert.equal(response.status, 401);
    assert.equal((await response.json()).success, false);
  });

  await t.test("regular user cannot read admin dashboard", async () => {
    const response = await request("/admin/dashboard", { role: "user" });
    assert.equal(response.status, 403);
    assert.equal((await response.json()).code, "ROLE_FORBIDDEN");
  });

  await t.test(
    "a regular user cannot call admin write APIs directly",
    async () => {
      const response = await request(`/admin/users/${adminId}/role`, {
        role: "user",
        method: "PATCH",
        body: { role: "admin", reason: "attempted direct escalation" },
      });
      assert.equal(response.status, 403);
    },
  );

  await t.test("all admin feature groups deny regular users", async () => {
    for (const path of [
      "/admin/plans/overview",
      "/admin/plans/history",
      "/admin/monitors",
      "/admin/incidents",
      "/admin/audit-logs",
      "/admin/plan-upgrade-requests",
      `/admin/users/${adminId}`,
    ]) {
      const response = await request(path, { role: "user" });
      assert.equal(response.status, 403, `${path} should reject regular users`);
    }
  });

  await t.test("administrators cannot create monitors", async () => {
    const response = await request("/monitors", {
      role: "admin",
      userId: adminId,
      method: "POST",
      body: { name: "Admin monitor", url: "https://example.com" },
    });
    assert.equal(response.status, 403);
    assert.equal((await response.json()).code, "PERMISSION_DENIED");
  });

  await t.test(
    "admin request passes role authorization and reaches validation",
    async () => {
      const response = await request("/admin/users?page=0", {
        role: "admin",
        userId: adminId,
      });
      assert.equal(response.status, 400);
      assert.equal((await response.json()).success, false);
    },
  );
});

test("admin list and audit APIs reject invalid pagination and filters", async (t) => {
  const headers = { role: "admin", userId: adminId };
  for (const [path, expectedStatus] of [
    ["/admin/users?limit=101", 400],
    ["/admin/monitors?limit=101", 400],
    ["/admin/incidents?page=-1", 400],
    [
      "/admin/audit-logs?startDate=not-a-date&endDate=2026-01-01T00%3A00%3A00.000Z",
      400,
    ],
    ["/admin/audit-logs?startDate=2026-01-01T00%3A00%3A00.000Z", 400],
  ]) {
    await t.test(path, async () => {
      const response = await request(path, headers);
      assert.equal(response.status, expectedStatus);
      assert.equal((await response.json()).success, false);
    });
  }
});

test("role and plan operations prevent self privilege changes", async (t) => {
  await t.test("an administrator cannot promote their own role", async () => {
    await assert.rejects(
      adminService.updateUserRole(
        adminId,
        "admin",
        { id: adminId },
        "self change",
      ),
      /cannot change your own role/i,
    );
  });

  await t.test(
    "an administrator cannot assign themselves a subscription plan",
    async () => {
      await assert.rejects(
        adminService.updateUserPlan(
          adminId,
          "unlimited",
          { id: adminId },
          { reason: "self grant" },
        ),
        /your own plan/i,
      );
    },
  );
});

test("last active administrator cannot be demoted or suspended", async (t) => {
  const target = {
    _id: testUserId,
    role: "admin",
    active: true,
    planStatus: "active",
    planStartedAt: new Date("2026-01-01T00:00:00.000Z"),
    planRenewsAt: new Date("2027-01-01T00:00:00.000Z"),
    planCanceledAt: null,
    planExpiredAt: null,
    save: mock.fn(async () => target),
  };
  const findStub = mock.method(User, "findById", async () => target);
  const countStub = mock.method(User, "countDocuments", async () => 1);
  try {
    await t.test("role demotion is blocked", async () => {
      await assert.rejects(
        adminService.updateUserRole(
          testUserId,
          "user",
          { id: adminId },
          "coverage",
        ),
        /last remaining admin/i,
      );
      assert.equal(target.save.mock.calls.length, 0);
    });
    await t.test("suspension is blocked", async () => {
      await assert.rejects(
        adminService.suspendUser(testUserId, { id: adminId }, "coverage"),
        /last active admin/i,
      );
      assert.equal(target.save.mock.calls.length, 0);
    });
  } finally {
    findStub.mock.restore();
    countStub.mock.restore();
  }
});

test("administrative role and plan changes persist and record an audit event", async (t) => {
  const user = {
    _id: testUserId,
    id: testUserId,
    name: "Target User",
    email: "target@example.com",
    role: "user",
    plan: "free",
    active: true,
    planHistory: [],
    save: mock.fn(async () => user),
    changePlan(plan, changedBy, options) {
      const previous = this.plan;
      this.plan = plan;
      this.planHistory.push({
        from: previous,
        to: plan,
        changedBy,
        ...options,
      });
    },
  };
  const findStub = mock.method(User, "findById", () => ({
    select: async () => user,
    then: (resolve, reject) => Promise.resolve(user).then(resolve, reject),
  }));
  const activityStub = mock.method(Activity, "create", async () => ({}));
  const adminCountStub = mock.method(User, "countDocuments", async () => 2);
  try {
    const changedPlan = await adminService.updateUserPlan(
      testUserId,
      "pro",
      { id: adminId },
      {
        reason: "Approved service expansion",
        expiresAt: new Date("2030-01-01"),
      },
    );
    assert.equal(changedPlan.user.plan, "pro");
    assert.equal(changedPlan.changeType, "upgrade");
    assert.equal(user.planHistory.at(-1).changedBy, adminId);

    const changedRole = await adminService.updateUserRole(
      testUserId,
      "admin",
      { id: adminId },
      "Operations access approved",
    );
    assert.equal(changedRole.role, "admin");
    assert.equal(changedRole.plan, null);
    assert.equal(changedRole.planStatus, null);
    assert.equal(changedRole.planStartedAt, null);
    assert.equal(changedRole.planRenewsAt, null);

    const demotedRole = await adminService.updateUserRole(
      testUserId,
      "user",
      { id: adminId },
      "Operations access removed",
    );
    assert.equal(demotedRole.role, "user");
    assert.equal(demotedRole.plan, "free");
    assert.equal(demotedRole.planStatus, "active");
    assert.ok(demotedRole.planStartedAt instanceof Date);

    assert.equal(activityStub.mock.calls.length, 4);
    assert.ok(
      activityStub.mock.calls.some(
        (call) => call.arguments[0].category === "admin",
      ),
    );
  } finally {
    mock.restoreAll();
  }
});

test("admin plan history includes approved requests and actual expirations", async () => {
  const approval = {
    _id: "64b000000000000000000010",
    action: "admin_plan_upgrade_request_approved",
    description: "Approved user@example.com's request",
    metadata: { targetEmail: "user@example.com", from: "free", to: "pro" },
    createdAt: new Date("2026-05-01T00:00:00.000Z"),
    user: { name: "Admin", email: "admin@example.com" },
  };
  const expiration = {
    _id: "64b000000000000000000011",
    action: "plan_downgraded",
    description: "Subscription expired; plan changed from pro to Free",
    metadata: { from: "pro", to: "free", reason: "subscription_expired" },
    createdAt: new Date("2026-05-02T00:00:00.000Z"),
    user: { name: "Expired User", email: "expired@example.com" },
  };
  let filter;
  let sort;
  let limit;
  let population;
  const query = {
    sort(value) {
      sort = value;
      return this;
    },
    limit(value) {
      limit = value;
      return this;
    },
    populate(path, fields) {
      population = { path, fields };
      return this;
    },
    lean: async () => [approval, expiration],
  };
  const findStub = mock.method(Activity, "find", (value) => {
    filter = value;
    return query;
  });

  try {
    const events = await adminService.getPlanHistory();
    assert.deepEqual(filter.$or, [
      { action: "admin_plan_upgrade_request_approved" },
      {
        action: "plan_downgraded",
        "metadata.reason": "subscription_expired",
      },
    ]);
    assert.deepEqual(sort, { createdAt: -1, _id: -1 });
    assert.equal(limit, 200);
    assert.deepEqual(population, { path: "user", fields: "name email" });
    assert.deepEqual(events, [
      {
        id: approval._id,
        type: "approval",
        user: { name: "Admin", email: "user@example.com" },
        from: "free",
        to: "pro",
        date: approval.createdAt,
        description: approval.description,
      },
      {
        id: expiration._id,
        type: "expiration",
        user: { name: "Expired User", email: "expired@example.com" },
        from: "pro",
        to: "free",
        date: expiration.createdAt,
        description: expiration.description,
      },
    ]);
  } finally {
    findStub.mock.restore();
  }
});

test("suspend and reactivate preserve ownership data and log their reasons", async () => {
  const user = {
    _id: testUserId,
    email: "target@example.com",
    role: "user",
    active: true,
    save: mock.fn(async () => user),
  };
  const findStub = mock.method(User, "findById", async () => user);
  const activityStub = mock.method(Activity, "create", async () => ({}));
  const collectionStub = mock.method(mongoose.connection, "collection", () => ({
    deleteMany: async () => ({ deletedCount: 2 }),
  }));
  try {
    await adminService.suspendUser(
      testUserId,
      { id: adminId },
      "Abuse investigation",
    );
    assert.equal(user.active, false);
    assert.equal(user.save.mock.calls.length, 1);
    assert.ok(
      activityStub.mock.calls.some((call) =>
        call.arguments[0].description.includes("Abuse investigation"),
      ),
    );

    await adminService.reactivateUser(
      testUserId,
      { id: adminId },
      "Review completed",
    );
    assert.equal(user.active, true);
    assert.equal(user.save.mock.calls.length, 2);
    assert.ok(
      activityStub.mock.calls.some((call) =>
        call.arguments[0].description.includes("Review completed"),
      ),
    );
  } finally {
    mock.restoreAll();
  }
});

test("admin monitor and incident lists apply filters, stable paging, and query caps", async () => {
  let monitorPipeline;
  const aggregateStub = mock.method(Monitor, "aggregate", async (pipeline) => {
    monitorPipeline = pipeline;
    return [{ data: [], total: [] }];
  });

  let incidentFilter;
  let incidentSkip;
  let incidentLimit;
  const incidentQuery = {
    populate() {
      return this;
    },
    sort() {
      return this;
    },
    skip(value) {
      incidentSkip = value;
      return this;
    },
    limit(value) {
      incidentLimit = value;
      return this;
    },
    lean: async () => [],
  };
  const incidentFindStub = mock.method(Incident, "find", (filter) => {
    incidentFilter = filter;
    return incidentQuery;
  });
  const countStub = mock.method(Incident, "countDocuments", async () => 0);
  try {
    const monitorResult = await adminOperations.listAdminMonitors({
      page: 2,
      limit: 10,
      ownerId: testUserId,
      plan: "pro",
      status: "active",
      incidentState: "active",
    });
    assert.deepEqual(monitorResult.monitors, []);
    assert.equal(monitorPipeline[0].$match.active, true);
    assert.equal(String(monitorPipeline[0].$match.owner), testUserId);
    assert.ok(
      monitorPipeline.some((stage) => stage.$facet?.data?.[0].$skip === 10),
    );
    assert.ok(
      monitorPipeline.some(
        (stage) => stage.$match?.["ownerInfo.plan"] === "pro",
      ),
    );

    const incidentResult = await adminOperations.listAdminIncidents({
      page: 3,
      limit: 10,
      severity: "critical",
      status: "ongoing",
    });
    assert.deepEqual(incidentResult.incidents, []);
    assert.equal(incidentFilter.severity, "critical");
    assert.equal(incidentFilter.status, "ongoing");
    assert.equal(incidentSkip, 20);
    assert.equal(incidentLimit, 10);
  } finally {
    mock.restoreAll();
  }
});

test("manual monitor check never fabricates a result for a missing monitor", async () => {
  const findStub = mock.method(Monitor, "findById", async () => null);
  try {
    await assert.rejects(
      adminOperations.runAdminMonitorCheck(testUserId, { id: adminId }),
      /already in progress or the monitor no longer exists/i,
    );
  } finally {
    mock.restoreAll();
  }
});

test("admin incident resolution respects the incident lifecycle", async () => {
  let resolveCalled = false;
  const incident = { status: "resolved", _id: testUserId };
  const query = {
    populate() {
      return this;
    },
    then(resolve, reject) {
      return Promise.resolve(incident).then(resolve, reject);
    },
  };
  const findStub = mock.method(Incident, "findOne", () => query);
  const resolveStub = mock.method(Incident, "resolve", async () => {
    resolveCalled = true;
  });
  try {
    await assert.rejects(
      adminOperations.resolveAdminIncident(
        testUserId,
        { resolutionNotes: "Already resolved" },
        { id: adminId },
      ),
      /invalid status transition/i,
    );
    assert.equal(resolveCalled, false);
  } finally {
    mock.restoreAll();
  }
});

test("upgrade requests cannot be reviewed more than once", async (t) => {
  const requestRecord = { status: "approved" };
  const findStub = mock.method(
    PlanUpgradeRequest,
    "findById",
    async () => requestRecord,
  );
  try {
    await t.test("approved request cannot be approved again", async () => {
      await assert.rejects(
        upgradeService.approveRequest(testUserId, { id: adminId }, {}),
        /already been approved/i,
      );
    });
    await t.test("approved request cannot be rejected", async () => {
      await assert.rejects(
        upgradeService.rejectRequest(testUserId, { id: adminId }, {}),
        /already been approved/i,
      );
    });
  } finally {
    findStub.mock.restore();
  }
});

test("an upgrade decision conflicts if the requester's plan changed meanwhile", async () => {
  const pending = {
    _id: testUserId,
    user: testUserId,
    currentPlan: "free",
    requestedPlan: "pro",
    status: "pending",
  };
  const requestStub = mock.method(
    PlanUpgradeRequest,
    "findById",
    async () => pending,
  );
  const userStub = mock.method(User, "findById", () => ({
    select: async () => ({ plan: "pro" }),
  }));
  try {
    await assert.rejects(
      upgradeService.approveRequest(testUserId, { id: adminId }, {}),
      /plan changed after this request was submitted/i,
    );
  } finally {
    mock.restoreAll();
  }
});

test("failed administrative operations are recorded with safe target metadata", async () => {
  let event;
  const activityStub = mock.method(Activity, "create", async (value) => {
    event = value;
    return {};
  });
  try {
    await auditService.recordFailedAdminOperation({
      admin: { id: adminId },
      method: "PATCH",
      path: `/users/${testUserId}/role`,
      statusCode: 400,
    });
    assert.equal(event.outcome, "failure");
    assert.equal(event.category, "admin");
    assert.equal(String(event.entityId), testUserId);
    assert.equal(event.entityType, "User");
    assert.equal(event.metadata.statusCode, 400);
    assert.equal(event.metadata.password, undefined);
    assert.equal(activityStub.mock.calls.length, 1);
  } finally {
    mock.restoreAll();
  }
});

test("audit redaction removes credentials recursively and from text", async () => {
  const { redactActivityText, sanitizeActivityMetadata } =
    await import("../src/utils/activityRedaction.js");
  const safe = sanitizeActivityMetadata({
    method: "PATCH",
    nested: {
      password: "plain secret",
      apiKey: "key-secret",
      reason: "Reviewed",
    },
    authorization: "Bearer abc",
  });
  assert.deepEqual(safe, {
    method: "PATCH",
    nested: { reason: "Reviewed" },
  });
  const message = redactActivityText(
    "Authorization: Bearer abc123 token=secret-value",
  );
  assert.doesNotMatch(message, /abc123|secret-value/);
  assert.match(message, /REDACTED/);
});

test("admin router and authorization middleware are wired to ADMIN", async () => {
  assert.equal(typeof authorize, "function");
  const source = await (
    await import("node:fs/promises")
  ).readFile(new URL("../src/routes/index.js", import.meta.url), "utf8");
  assert.match(
    source,
    /router\.use\("\/admin",\s*isAuthenticated,\s*authorize\(ROLES\.ADMIN\),\s*adminRoutes\)/,
  );
});
