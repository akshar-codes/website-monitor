import test from "node:test";
import assert from "node:assert/strict";
import {
  createStatusPageSchema,
  maintenanceCreateSchema,
  subscriptionSchema,
} from "../src/validators/statusPage.validator.js";
import {
  calculateOverallStatus,
  mapMonitorStatus,
} from "../src/services/statusAggregation.service.js";
import { PLAN_DEFINITIONS } from "../src/config/plans.js";
import { PLANS } from "../src/config/constants.js";
import StatusPage from "../src/models/StatusPage.js";
import StatusMaintenance from "../src/models/StatusMaintenance.js";
import StatusIncident from "../src/models/StatusIncident.js";
import HealthCheck from "../src/models/HealthCheck.js";
import DailyStat from "../src/models/DailyStat.js";
import User from "../src/models/User.js";
import {
  addService,
  getOwned,
  getPublic,
} from "../src/services/statusPage.service.js";

test("status page input normalizes slugs and rejects reserved routes", () => {
  assert.equal(
    createStatusPageSchema.parse({
      name: "Acme",
      slug: "Acme-Status",
      timezone: "UTC",
    }).slug,
    "acme-status",
  );
  assert.equal(
    createStatusPageSchema.safeParse({ name: "Acme", slug: "admin" }).success,
    false,
  );
  assert.equal(
    createStatusPageSchema.safeParse({ name: "Acme", slug: "bad--slug" })
      .success,
    false,
  );
  assert.equal(
    createStatusPageSchema.safeParse({
      name: "Acme",
      slug: "acme",
      timezone: "Not/AZone",
    }).success,
    false,
  );
});

test("public uptime status respects staleness and confirmation thresholds", () => {
  assert.equal(
    mapMonitorStatus({ active: false, stale: false, status: "up" }),
    "unknown",
  );
  assert.equal(
    mapMonitorStatus({ active: true, stale: true, status: "up" }),
    "unknown",
  );
  assert.equal(
    mapMonitorStatus({
      active: true,
      stale: false,
      status: "down",
      consecutiveFailures: 1,
      failureThreshold: 2,
    }),
    "degraded",
  );
  assert.equal(
    mapMonitorStatus({
      active: true,
      stale: false,
      status: "down",
      consecutiveFailures: 2,
      failureThreshold: 2,
    }),
    "major_outage",
  );
});

test("overall status distinguishes partial and major outages and accounts for incidents", () => {
  assert.equal(
    calculateOverallStatus(["major_outage", "operational"]),
    "partial_outage",
  );
  assert.equal(
    calculateOverallStatus(["major_outage", "major_outage"]),
    "major_outage",
  );
  assert.equal(calculateOverallStatus(["unknown", "operational"]), "unknown");
  assert.equal(
    calculateOverallStatus(["operational"], [{ severity: "critical" }]),
    "major_outage",
  );
  assert.equal(
    calculateOverallStatus(["operational"], [{ severity: "major" }]),
    "partial_outage",
  );
});

test("maintenance and subscription payloads reject invalid values", () => {
  const base = {
    title: "Database work",
    scheduledStart: "2026-10-31T10:00:00Z",
    scheduledEnd: "2026-10-31T11:00:00Z",
  };
  assert.equal(maintenanceCreateSchema.safeParse(base).success, true);
  assert.equal(
    maintenanceCreateSchema.safeParse({
      ...base,
      scheduledEnd: "2026-10-31T09:00:00Z",
    }).success,
    false,
  );
  assert.equal(
    subscriptionSchema.safeParse({
      email: "visitor@example.com",
      preferences: { incidents: true },
    }).success,
    true,
  );
  assert.equal(
    subscriptionSchema.safeParse({ email: "not-an-email" }).success,
    false,
  );
});

test("status page limits are centralized in plan definitions", () => {
  assert.deepEqual(
    [PLANS.FREE, PLANS.PRO, PLANS.UNLIMITED].map(
      (plan) => PLAN_DEFINITIONS[plan].limits.maxStatusPages,
    ),
    [1, 3, 10],
  );
  assert.deepEqual(
    [PLANS.FREE, PLANS.PRO, PLANS.UNLIMITED].map(
      (plan) => PLAN_DEFINITIONS[plan].limits.maxStatusServicesPerPage,
    ),
    [3, 15, 50],
  );
});

test("public status DTO excludes monitor targets, owner IDs, check snapshots, and subscriber data", async (t) => {
  const ownerId = "64b000000000000000000001";
  const monitorId = "64b000000000000000000002";
  const serviceId = "64b000000000000000000003";
  const page = {
    _id: "64b000000000000000000004",
    owner: ownerId,
    name: "Acme",
    slug: "acme",
    description: "Public systems",
    logo: "https://example.com/logo.png",
    branding: { theme: "light", accentColor: "#15803d" },
    timezone: "UTC",
    updatedAt: new Date("2026-10-31T00:00:00Z"),
    services: [
      {
        _id: serviceId,
        monitor: {
          _id: monitorId,
          owner: ownerId,
          active: true,
          interval: 300,
          consecutiveFailures: 0,
          url: "https://private.example.com/secret",
        },
        displayName: "API",
        description: "Public API",
        displayOrder: 0,
        isVisible: true,
      },
    ],
  };
  t.mock.method(StatusPage, "findOne", () => ({
    populate() {
      return this;
    },
    async lean() {
      return page;
    },
  }));
  t.mock.method(User, "findById", () => ({
    select() {
      return this;
    },
    async lean() {
      return { plan: PLANS.PRO };
    },
  }));
  t.mock.method(DailyStat, "aggregate", async () => [
    {
      _id: monitorId,
      total: 10,
      successful: 10,
      firstDate: new Date("2026-10-25T00:00:00Z"),
    },
  ]);
  t.mock.method(HealthCheck, "findOne", () => ({
    sort() {
      return this;
    },
    select() {
      return this;
    },
    async lean() {
      return {
        status: "up",
        checkedAt: new Date(),
        rawResponse: { private: "secret" },
      };
    },
  }));
  t.mock.method(HealthCheck, "uptimePercent", async () => 100);
  t.mock.method(StatusMaintenance, "find", () => ({
    sort() {
      return this;
    },
    limit() {
      return this;
    },
    async lean() {
      return [];
    },
  }));
  t.mock.method(StatusIncident, "find", () => ({
    sort() {
      return this;
    },
    limit() {
      return this;
    },
    async lean() {
      return [];
    },
  }));

  const result = await getPublic("acme");
  assert.deepEqual(
    Object.keys(result).sort(),
    [
      "branding",
      "description",
      "incidents",
      "logo",
      "maintenance",
      "name",
      "services",
      "slug",
      "status",
      "timezone",
      "updatedAt",
    ].sort(),
  );
  assert.deepEqual(result.services[0], {
    name: "API",
    description: "Public API",
    status: "operational",
    uptimePercentage: 100,
    uptimeDays: result.services[0].uptimeDays,
    uptimeWindow: "90d",
    lastCheckedAt: result.services[0].lastCheckedAt,
  });
  assert.equal(JSON.stringify(result).includes("private.example.com"), false);
  assert.equal(JSON.stringify(result).includes("rawResponse"), false);
  assert.equal(JSON.stringify(result).includes("subscriber"), false);
  assert.equal(JSON.stringify(result).includes(ownerId), false);
});

test("management lookups scope pages and monitor associations to the owner", async (t) => {
  const ownerId = "64b000000000000000000001";
  const pageId = "64b000000000000000000004";
  const monitorId = "64b000000000000000000002";
  const filters = [];
  const page = {
    _id: pageId,
    owner: ownerId,
    services: [],
    save: async () => page,
    toJSON: () => page,
  };
  let calls = 0;
  t.mock.method(StatusPage, "findOne", async (filter) => {
    filters.push(filter);
    calls += 1;
    return calls === 1 ? null : page;
  });
  t.mock.method(
    (await import("../src/models/Monitor.js")).default,
    "findOne",
    async (filter) => {
      filters.push(filter);
      return null;
    },
  );
  await assert.rejects(
    getOwned(pageId, { _id: ownerId }),
    (error) => error.statusCode === 404,
  );
  await assert.rejects(
    addService(pageId, { _id: ownerId, plan: PLANS.PRO }, { monitorId }),
    (error) => error.statusCode === 404,
  );
  assert.equal(String(filters[0].owner), ownerId);
  assert.equal(String(filters.at(-1).owner), ownerId);
});
