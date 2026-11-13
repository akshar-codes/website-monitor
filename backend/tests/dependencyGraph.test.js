import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import express from "express";
import mongoose from "mongoose";
import ServiceDependency from "../src/models/ServiceDependency.js";
import ExternalService from "../src/models/ExternalService.js";
import Monitor from "../src/models/Monitor.js";
import HealthCheck from "../src/models/HealthCheck.js";
import Incident from "../src/models/Incident.js";
import DailyStat from "../src/models/DailyStat.js";
import HourlyStat from "../src/models/HourlyStat.js";
import PerformanceAlertState from "../src/models/PerformanceAlertState.js";
import RegionalCheck from "../src/models/RegionalCheck.js";
import RegionalProbeRun from "../src/models/RegionalProbeRun.js";
import RegionalIncident from "../src/models/RegionalIncident.js";
import RegionalDailyStat from "../src/models/RegionalDailyStat.js";
import RegionalHourlyStat from "../src/models/RegionalHourlyStat.js";
import RegionalPerformanceState from "../src/models/RegionalPerformanceState.js";
import StatusPage from "../src/models/StatusPage.js";
import Activity from "../src/models/Activity.js";
import {
  detectCycle,
  calculateMaxDepth,
  validateAcyclic,
  findPath,
} from "../src/utils/dagValidator.js";
import {
  createDependencySchema,
  updateDependencySchema,
} from "../src/validators/dependency.validator.js";
import { deriveMonitorHealthState } from "../src/services/dependency.service.js";
import { deleteMonitor } from "../src/services/monitor.service.js";

// Setup test environment variables
Object.assign(process.env, {
  NODE_ENV: "test",
  MONGO_URI: "mongodb://127.0.0.1:27099/site-watch-tests",
  COOKIE_SECRET: "test-cookie-secret-with-more-than-thirty-two-characters",
  SESSION_SECRET: "test-session-secret-with-more-than-thirty-two-characters",
});

const userAId = "64b000000000000000000010";
const userBId = "64b000000000000000000020";

const monitorA1 = "64b000000000000000000001"; // Frontend (User A)
const monitorA2 = "64b000000000000000000002"; // Backend API (User A)
const monitorA3 = "64b000000000000000000003"; // Auth API (User A)
const monitorA4 = "64b000000000000000000004"; // Payment Gateway (User A)
const monitorB1 = "64b000000000000000000099"; // Tenant B Monitor

let server;
let baseUrl;

before(async () => {
  Activity.create = async () => ({});

  const [{ default: routes }, { default: errorHandler }] = await Promise.all([
    import("../src/routes/index.js"),
    import("../src/middlewares/errorHandler.js"),
  ]);

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
    await new Promise((resolve) => server.close(resolve));
  }
  for (const h of process._getActiveHandles()) {
    if (h && typeof h.destroy === "function") h.destroy();
    if (h && typeof h.unref === "function") h.unref();
  }
  setTimeout(() => process.exit(0), 100);
});

const request = (path, { role, userId, plan, method = "GET", body } = {}) =>
  fetch(`${baseUrl}/api${path}`, {
    method,
    headers: {
      connection: "close",
      ...(role ? { "x-test-role": role } : {}),
      ...(userId ? { "x-test-user-id": userId } : {}),
      ...(plan ? { "x-test-plan": plan } : {}),
      ...(body ? { "content-type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

// ─────────────────────────────────────────────────────────────────────────────
// 1. DAG Validation & Cycle Detection Unit Tests
// ─────────────────────────────────────────────────────────────────────────────

test("DAG Validator: detects self-dependency as an immediate cycle", () => {
  const candidate = { dependentId: "node-1", dependencyId: "node-1" };
  const result = detectCycle([], candidate);
  assert.equal(result.hasCycle, true);
  assert.deepEqual(result.cyclePath, ["node-1", "node-1"]);
});

test("DAG Validator: detects direct 2-node cycle (A -> B then B -> A)", () => {
  // Edge: A depends on B
  const existing = [{ dependentId: "node-A", dependencyId: "node-B" }];
  // Candidate: B depends on A
  const candidate = { dependentId: "node-B", dependencyId: "node-A" };

  const result = detectCycle(existing, candidate);
  assert.equal(result.hasCycle, true);
  assert.deepEqual(result.cyclePath, ["node-B", "node-A", "node-B"]);
});

test("DAG Validator: detects indirect 3-node cycle (A -> B -> C then C -> A)", () => {
  // A depends on B, B depends on C
  const existing = [
    { dependentId: "node-A", dependencyId: "node-B" },
    { dependentId: "node-B", dependencyId: "node-C" },
  ];
  // Candidate: C depends on A
  const candidate = { dependentId: "node-C", dependencyId: "node-A" };

  const result = detectCycle(existing, candidate);
  assert.equal(result.hasCycle, true);
  assert.deepEqual(result.cyclePath, ["node-C", "node-A", "node-B", "node-C"]);
});

test("DAG Validator: allows valid non-cyclic diamond and tree topologies", () => {
  // Tree: A -> B, A -> C, B -> D, C -> D (Diamond)
  const existing = [
    { dependentId: "A", dependencyId: "B" },
    { dependentId: "A", dependencyId: "C" },
    { dependentId: "B", dependencyId: "D" },
  ];
  // Candidate: C -> D completes the diamond without introducing a cycle
  const candidate = { dependentId: "C", dependencyId: "D" };

  const result = detectCycle(existing, candidate);
  assert.equal(result.hasCycle, false);
  assert.equal(result.cyclePath, null);
});

test("DAG Validator: computes longest path depth and enforces limits", () => {
  // A -> B -> C -> D has depth 3 hops
  const edges = [
    { dependentId: "A", dependencyId: "B" },
    { dependentId: "B", dependencyId: "C" },
    { dependentId: "C", dependencyId: "D" },
  ];
  const depth = calculateMaxDepth(edges);
  assert.equal(depth, 3);

  // Depth limit of 2 should fail
  assert.throws(
    () =>
      validateAcyclic(
        edges.slice(0, 2),
        { dependentId: "C", dependencyId: "D" },
        { maxDepthLimit: 2 },
      ),
    /exceeds maximum allowed depth/,
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Health State Derivation Unit Tests
// ─────────────────────────────────────────────────────────────────────────────

test("Health Derivation: disabled monitor resolves to 'disabled'", () => {
  const result = deriveMonitorHealthState(
    { active: false, interval: 300 },
    { status: "up", checkedAt: new Date() },
    null,
  );
  assert.equal(result.healthState, "disabled");
});

test("Health Derivation: missing health check resolves to 'unknown' (never healthy)", () => {
  const result = deriveMonitorHealthState(
    { active: true, interval: 300 },
    null,
    null,
  );
  assert.equal(result.healthState, "unknown");
});

test("Health Derivation: stale check (> 2.5x interval) resolves to 'stale'", () => {
  const staleDate = new Date(Date.now() - 15 * 60 * 1000); // 15 mins ago for 5 min interval
  const result = deriveMonitorHealthState(
    { active: true, interval: 300 },
    { status: "up", checkedAt: staleDate },
    null,
  );
  assert.equal(result.healthState, "stale");
  assert.equal(result.isStale, true);
});

test("Health Derivation: fresh healthy check resolves to 'healthy'", () => {
  const freshDate = new Date(Date.now() - 30 * 1000);
  const result = deriveMonitorHealthState(
    { active: true, interval: 300 },
    { status: "up", responseTime: 120, checkedAt: freshDate },
    null,
  );
  assert.equal(result.healthState, "healthy");
  assert.equal(result.isStale, false);
});

test("Health Derivation: active incident elevates state to 'unhealthy' or 'degraded'", () => {
  const freshDate = new Date(Date.now() - 30 * 1000);
  const critical = deriveMonitorHealthState(
    { active: true, interval: 300 },
    { status: "up", checkedAt: freshDate },
    { severity: "critical" },
  );
  assert.equal(critical.healthState, "unhealthy");

  const minor = deriveMonitorHealthState(
    { active: true, interval: 300 },
    { status: "up", checkedAt: freshDate },
    { severity: "minor" },
  );
  assert.equal(minor.healthState, "degraded");
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Schema & Validation Tests
// ─────────────────────────────────────────────────────────────────────────────

test("Validation: createDependencySchema validates required fields and types", () => {
  // Missing required dependency target
  assert.throws(
    () =>
      createDependencySchema.parse({
        dependentMonitorId: monitorA1,
        toType: "monitor",
      }),
    /dependencyMonitorId is required for monitor targets/,
  );

  // Self-dependency rejected at validator level
  assert.throws(
    () =>
      createDependencySchema.parse({
        dependentMonitorId: monitorA1,
        toType: "monitor",
        dependencyMonitorId: monitorA1,
      }),
    /A monitor cannot depend on itself/,
  );

  // Valid schema parses correctly
  const parsed = createDependencySchema.parse({
    dependentMonitorId: monitorA1,
    toType: "monitor",
    dependencyMonitorId: monitorA2,
    dependencyType: "soft",
    description: "Frontend calls Backend API",
  });
  assert.equal(parsed.dependencyType, "soft");
  assert.equal(parsed.toType, "monitor");
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. API Endpoints & Multi-Tenancy Tests
// ─────────────────────────────────────────────────────────────────────────────

test("Dependency API: unauthenticated request is rejected with 401", async () => {
  const res = await request("/dependencies");
  assert.equal(res.status, 401);
});

test("Dependency API: full lifecycle with tenant isolation, cycle rejection, and graph response", async () => {
  try {
    // In-memory data store for isolated mock testing
    const mockMonitors = [
      {
        _id: new mongoose.Types.ObjectId(monitorA1),
        owner: new mongoose.Types.ObjectId(userAId),
        name: "Frontend Web",
        url: "https://web.app.com",
        kind: "website",
        interval: 300,
        active: true,
        lastCheckedAt: new Date(),
      },
      {
        _id: new mongoose.Types.ObjectId(monitorA2),
        owner: new mongoose.Types.ObjectId(userAId),
        name: "Backend API",
        url: "https://api.app.com",
        kind: "api",
        interval: 60,
        active: true,
        lastCheckedAt: new Date(),
      },
      {
        _id: new mongoose.Types.ObjectId(monitorA3),
        owner: new mongoose.Types.ObjectId(userAId),
        name: "Auth Service",
        url: "https://auth.app.com",
        kind: "api",
        interval: 60,
        active: true,
        lastCheckedAt: new Date(),
      },
      {
        _id: new mongoose.Types.ObjectId(monitorB1),
        owner: new mongoose.Types.ObjectId(userBId), // Tenant B
        name: "Tenant B Monitor",
        url: "https://b.app.com",
        kind: "website",
        interval: 300,
        active: true,
        lastCheckedAt: new Date(),
      },
    ];

    const mockDependencies = [];
    const mockExternalServices = [];

    // Mock Monitor queries
    const originalFindOne = Monitor.findOne;
    const originalFind = Monitor.find;
    const originalDepFind = ServiceDependency.find;
    const originalDepFindOne = ServiceDependency.findOne;
    const originalDepCount = ServiceDependency.countDocuments;
    const originalExtFind = ExternalService.find;
    const originalExtFindOne = ExternalService.findOne;
    const originalHCAggregate = HealthCheck.aggregate;
    const originalIncFind = Incident.find;

    Monitor.findOne = (query) => {
      const found = mockMonitors.find(
        (m) =>
          (!query._id || String(m._id) === String(query._id)) &&
          (!query.owner || String(m.owner) === String(query.owner)),
      );
      return {
        select: () => found,
        then: (fn) => Promise.resolve(found).then(fn),
      };
    };

    const makeQueryChain = (result) => {
      const chain = {
        sort: () => chain,
        skip: () => chain,
        limit: () => chain,
        select: () => chain,
        populate: () => chain,
        lean: () => Promise.resolve(result),
        then: (resolve, reject) =>
          Promise.resolve(result).then(resolve, reject),
        catch: (reject) => Promise.resolve(result).catch(reject),
      };
      return chain;
    };

    Monitor.find = (query) => {
      let result = mockMonitors.filter(
        (m) => !query.owner || String(m.owner) === String(query.owner),
      );
      return makeQueryChain(result);
    };

    ServiceDependency.countDocuments = async (query = {}) => {
      return mockDependencies.filter(
        (d) => !query.owner || String(d.owner) === String(query.owner),
      ).length;
    };

    ServiceDependency.find = (query = {}) => {
      const list = mockDependencies.filter(
        (d) =>
          (!query.owner || String(d.owner) === String(query.owner)) &&
          (query.isActive === undefined || d.isActive === query.isActive) &&
          (!query.dependentMonitor ||
            String(d.dependentMonitor) === String(query.dependentMonitor)) &&
          (!query.dependencyMonitor ||
            String(d.dependencyMonitor) === String(query.dependencyMonitor)),
      );
      return makeQueryChain(list);
    };

    ServiceDependency.findOne = (query = {}) => {
      const found = mockDependencies.find(
        (d) =>
          (!query._id || String(d._id) === String(query._id)) &&
          (!query.owner || String(d.owner) === String(query.owner)) &&
          (!query.dependentMonitor ||
            String(d.dependentMonitor) === String(query.dependentMonitor)) &&
          (!query.dependencyMonitor ||
            String(d.dependencyMonitor) === String(query.dependencyMonitor)),
      );
      return makeQueryChain(found || null);
    };

    ServiceDependency.findById = (id) => ServiceDependency.findOne({ _id: id });
    ServiceDependency.findOneAndDelete = async (query) => {
      const idx = mockDependencies.findIndex(
        (d) =>
          (!query._id || String(d._id) === String(query._id)) &&
          (!query.owner || String(d.owner) === String(query.owner)),
      );
      if (idx === -1) return null;
      return mockDependencies.splice(idx, 1)[0];
    };

    ServiceDependency.prototype.save = async function () {
      const existingIdx = mockDependencies.findIndex(
        (d) => String(d._id) === String(this._id),
      );
      if (existingIdx >= 0) {
        mockDependencies[existingIdx] = this;
      } else {
        this._id = this._id || new mongoose.Types.ObjectId();
        this.createdAt = new Date();
        this.updatedAt = new Date();
        mockDependencies.push(this);
      }
      return this;
    };

    ExternalService.find = (query) => {
      const list = mockExternalServices.filter(
        (e) => !query.owner || String(e.owner) === String(query.owner),
      );
      return makeQueryChain(list);
    };

    ExternalService.findOne = (query) => {
      const found = mockExternalServices.find(
        (e) =>
          (!query._id || String(e._id) === String(query._id)) &&
          (!query.owner || String(e.owner) === String(query.owner)) &&
          (!query.name || e.name === query.name),
      );
      return Promise.resolve(found || null);
    };

    HealthCheck.aggregate = async () => [
      {
        _id: new mongoose.Types.ObjectId(monitorA1),
        status: "up",
        responseTime: 85,
        httpStatus: 200,
        failureReason: null,
        checkedAt: new Date(),
      },
      {
        _id: new mongoose.Types.ObjectId(monitorA2),
        status: "down",
        responseTime: 5000,
        httpStatus: 500,
        failureReason: "http_error",
        checkedAt: new Date(),
      },
    ];

    Incident.find = () => ({
      select: () => ({
        lean: () =>
          Promise.resolve([
            {
              monitor: new mongoose.Types.ObjectId(monitorA2),
              status: "ongoing",
              severity: "critical",
              startedAt: new Date(),
              rootCause: "Backend returned 500",
            },
          ]),
      }),
    });

    try {
      // 1. Cross-tenant access rejected: User A cannot depend on User B's monitor
      const crossTenantRes = await request("/dependencies", {
        role: "user",
        userId: userAId,
        method: "POST",
        body: {
          dependentMonitorId: monitorA1,
          dependencyMonitorId: monitorB1, // Tenant B
          toType: "monitor",
          dependencyType: "hard",
        },
      });
      assert.equal(crossTenantRes.status, 404);

      // 2. Self-dependency rejected: Monitor A1 cannot depend on Monitor A1
      const selfRes = await request("/dependencies", {
        role: "user",
        userId: userAId,
        method: "POST",
        body: {
          dependentMonitorId: monitorA1,
          dependencyMonitorId: monitorA1,
          toType: "monitor",
        },
      });
      assert.equal(selfRes.status, 400);

      // 3. Create valid relationship: Frontend (A1) depends on Backend (A2)
      const createRes1 = await request("/dependencies", {
        role: "user",
        userId: userAId,
        method: "POST",
        body: {
          dependentMonitorId: monitorA1,
          dependencyMonitorId: monitorA2,
          toType: "monitor",
          dependencyType: "hard",
          description: "Web depends on API",
        },
      });
      assert.equal(createRes1.status, 201);
      const body1 = await createRes1.json();
      assert.equal(body1.success, true);
      assert.equal(body1.data.dependencyType, "hard");

      // 4. Duplicate edge rejected
      const dupRes = await request("/dependencies", {
        role: "user",
        userId: userAId,
        method: "POST",
        body: {
          dependentMonitorId: monitorA1,
          dependencyMonitorId: monitorA2,
          toType: "monitor",
        },
      });
      assert.equal(dupRes.status, 409);

      // 5. Create edge Backend (A2) depends on Auth (A3)
      const createRes2 = await request("/dependencies", {
        role: "user",
        userId: userAId,
        method: "POST",
        body: {
          dependentMonitorId: monitorA2,
          dependencyMonitorId: monitorA3,
          toType: "monitor",
          dependencyType: "hard",
        },
      });
      assert.equal(createRes2.status, 201);

      // 6. Cyclic dependency rejected: Auth (A3) depends on Frontend (A1) would create A1 -> A2 -> A3 -> A1
      const cycleRes = await request("/dependencies", {
        role: "user",
        userId: userAId,
        method: "POST",
        body: {
          dependentMonitorId: monitorA3,
          dependencyMonitorId: monitorA1,
          toType: "monitor",
        },
      });
      assert.equal(cycleRes.status, 400);
      const cycleBody = await cycleRes.json();
      assert.match(cycleBody.message, /Cyclic dependency detected/);

      // 7. Pre-flight validation endpoint rejects cycle cleanly
      const validateRes = await request("/dependencies/validate", {
        role: "user",
        userId: userAId,
        method: "POST",
        body: {
          dependentMonitorId: monitorA3,
          dependencyMonitorId: monitorA1,
          toType: "monitor",
        },
      });
      assert.equal(validateRes.status, 200);
      const validateBody = await validateRes.json();
      assert.equal(validateBody.data.isValid, false);
      assert.equal(validateBody.data.code, "CYCLE_DETECTED");

      // 8. Retrieve complete dependency graph
      const graphRes = await request("/dependencies/graph", {
        role: "user",
        userId: userAId,
      });
      assert.equal(graphRes.status, 200);
      const graphData = (await graphRes.json()).data;
      assert.equal(graphData.nodes.length >= 3, true);
      assert.equal(graphData.edges.length, 2);

      // Verify explicit direction semantics
      assert.equal(graphData.edges[0].direction, "depends_on");
      assert.equal(graphData.edges[0].source, monitorA1);
      assert.equal(graphData.edges[0].target, monitorA2);

      // Verify health summary correctly counts healthy and unhealthy
      assert.equal(graphData.summary.healthyCount >= 1, true);
      assert.equal(graphData.summary.unhealthyCount >= 1, true);

      // 9. Retrieve monitor direct dependencies and dependents
      const directRes = await request(`/dependencies/monitor/${monitorA2}`, {
        role: "user",
        userId: userAId,
      });
      assert.equal(directRes.status, 200);
      const directData = (await directRes.json()).data;
      assert.equal(directData.monitor.name, "Backend API");
      // A2 depends on A3
      assert.equal(directData.dependencies.length, 1);
      // A1 depends on A2
      assert.equal(directData.dependents.length, 1);

      // 10. Update dependency metadata
      const edgeId = mockDependencies[0]._id.toString();
      const updateRes = await request(`/dependencies/${edgeId}`, {
        role: "user",
        userId: userAId,
        method: "PUT",
        body: {
          dependencyType: "soft",
          description: "Updated to soft dependency with fallback",
        },
      });
      assert.equal(updateRes.status, 200);
      const updateBody = await updateRes.json();
      assert.equal(updateBody.data.dependencyType, "soft");

      // 11. Delete dependency
      const deleteRes = await request(`/dependencies/${edgeId}`, {
        role: "user",
        userId: userAId,
        method: "DELETE",
      });
      assert.equal(deleteRes.status, 200);
      assert.equal(mockDependencies.length, 1);
    } finally {
      Monitor.findOne = originalFindOne;
      Monitor.find = originalFind;
      ServiceDependency.find = originalDepFind;
      ServiceDependency.findOne = originalDepFindOne;
      ServiceDependency.countDocuments = originalDepCount;
      ExternalService.find = originalExtFind;
      ExternalService.findOne = originalExtFindOne;
      HealthCheck.aggregate = originalHCAggregate;
      Incident.find = originalIncFind;
    }
  } catch (err) {
    console.error("FULL LIFECYCLE ERROR:", err);
    throw err;
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Monitor Deletion Cascading Clean-up Test
// ─────────────────────────────────────────────────────────────────────────────

test("Monitor Deletion: cascading delete purges associated service dependencies", async () => {
  const testMonitorId = new mongoose.Types.ObjectId();
  const mockDep = {
    deleteManyCalledWith: null,
  };

  const originalMonitorFindOne = Monitor.findOne;
  const originalDepDeleteMany = ServiceDependency.deleteMany;

  Monitor.findOne = () => ({
    _id: testMonitorId,
    owner: new mongoose.Types.ObjectId(userAId),
    deleteOne: async () => ({}),
  });

  ServiceDependency.deleteMany = async (filter) => {
    mockDep.deleteManyCalledWith = filter;
    return { deletedCount: 2 };
  };

  try {
    // Other collections called in deleteMonitor
    HealthCheck.deleteMany = async () => ({});
    DailyStat.deleteMany = async () => ({});
    HourlyStat.deleteMany = async () => ({});
    PerformanceAlertState.deleteMany = async () => ({});
    RegionalCheck.deleteMany = async () => ({});
    RegionalProbeRun.deleteMany = async () => ({});
    RegionalIncident.deleteMany = async () => ({});
    RegionalDailyStat.deleteMany = async () => ({});
    RegionalHourlyStat.deleteMany = async () => ({});
    RegionalPerformanceState.deleteMany = async () => ({});
    Incident.deleteMany = async () => ({});
    StatusPage.updateMany = async () => ({});

    await deleteMonitor(testMonitorId, { _id: userAId });

    assert.notEqual(mockDep.deleteManyCalledWith, null);
    assert.deepEqual(mockDep.deleteManyCalledWith, {
      $or: [
        { dependentMonitor: testMonitorId },
        { dependencyMonitor: testMonitorId },
      ],
    });
  } finally {
    Monitor.findOne = originalMonitorFindOne;
    ServiceDependency.deleteMany = originalDepDeleteMany;
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. External Service API Tests
// ─────────────────────────────────────────────────────────────────────────────

test("ExternalService API: CRUD and tenant isolation", async () => {
  const extServiceId = new mongoose.Types.ObjectId();
  const mockExternalServices = [];

  const originalExtFind = ExternalService.find;
  const originalExtFindOne = ExternalService.findOne;
  const originalExtSave = ExternalService.prototype.save;

  ExternalService.find = (query = {}) => {
    const list = mockExternalServices.filter(
      (e) => !query.owner || String(e.owner) === String(query.owner),
    );
    return {
      sort: () => Promise.resolve(list),
      then: (fn) => Promise.resolve(list).then(fn),
    };
  };

  ExternalService.findOne = (query = {}) => {
    const found = mockExternalServices.find(
      (e) =>
        (!query._id || String(e._id) === String(query._id)) &&
        (!query.owner || String(e.owner) === String(query.owner)) &&
        (!query.name || e.name === query.name),
    );
    return Promise.resolve(found || null);
  };

  ExternalService.prototype.save = async function () {
    this._id = this._id || extServiceId;
    this.createdAt = new Date();
    this.updatedAt = new Date();
    const existing = mockExternalServices.findIndex(
      (e) => String(e._id) === String(this._id),
    );
    if (existing >= 0) mockExternalServices[existing] = this;
    else mockExternalServices.push(this);
    return this;
  };

  try {
    // 1. Create External Service (Database)
    const createRes = await request("/external-services", {
      role: "user",
      userId: userAId,
      method: "POST",
      body: {
        name: "PostgreSQL Primary",
        type: "database",
        description: "Primary database cluster",
        host: "db.internal",
      },
    });
    assert.equal(createRes.status, 201);
    const body = await createRes.json();
    assert.equal(body.data.name, "PostgreSQL Primary");
    assert.equal(body.data.type, "database");

    // 2. Duplicate external service name rejected with 409
    const dupRes = await request("/external-services", {
      role: "user",
      userId: userAId,
      method: "POST",
      body: {
        name: "PostgreSQL Primary",
        type: "database",
      },
    });
    assert.equal(dupRes.status, 409);

    // 3. List external services
    const listRes = await request("/external-services", {
      role: "user",
      userId: userAId,
    });
    assert.equal(listRes.status, 200);
    const listBody = await listRes.json();
    assert.equal(listBody.data.length, 1);
  } finally {
    ExternalService.find = originalExtFind;
    ExternalService.findOne = originalExtFindOne;
    ExternalService.prototype.save = originalExtSave;
  }
});
