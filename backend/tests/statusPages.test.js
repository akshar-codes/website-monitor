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
  verifySubscription,
  unsubscribe,
} from "../src/services/statusPage.service.js";
import StatusSubscriber from "../src/models/StatusSubscriber.js";
import StatusDelivery from "../src/models/StatusDelivery.js";
import Monitor from "../src/models/Monitor.js";
import { syncMonitorIncident } from "../src/services/statusIncidentSync.service.js";
import express from "express";
import statusPageRoutes from "../src/routes/statusPage.routes.js";
import publicStatusRoutes from "../src/routes/publicStatus.routes.js";
import errorHandler from "../src/middlewares/errorHandler.js";
import { deliverBatch } from "../src/workers/statusNotificationWorker.js";
import {
  enqueueStatusEvent,
  tokenHash,
  makeUnsubscribeToken,
  deliveryRetry,
} from "../src/services/statusNotification.service.js";

test("status page input normalizes slugs and rejects reserved routes", () => {
  assert.equal(
    createStatusPageSchema.parse({
      name: "Acme",
      slug: "Acme-Status",
      timezone: "UTC",
      branding: { theme: "dark", accentColor: "#123abc" },
    }).slug,
    "acme-status",
  );
  assert.deepEqual(
    createStatusPageSchema.parse({
      name: "Acme",
      slug: "acme",
      branding: { theme: "dark", accentColor: "#123abc" },
    }).branding,
    { theme: "dark", accentColor: "#123abc" },
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

test("subscription verification, preferences, and unsubscribe invalidate tokens safely", async (t) => {
  const subscriber = {
    isVerified: false,
    isActive: true,
    preferences: { incidents: true, incidentUpdates: true, maintenance: true },
    save: async () => {},
  };
  t.mock.method(StatusSubscriber, "findOne", () => ({
    select: async () => subscriber,
  }));
  assert.equal(await verifySubscription("one-time-verification-token"), true);
  assert.equal(subscriber.isVerified, true);
  assert.equal(subscriber.verificationTokenHash, null);

  const identity = { _id: "64b000000000000000000010", createdAt: new Date() };
  const token = makeUnsubscribeToken(identity);
  const unsubscribeSubscriber = {
    ...identity,
    isActive: true,
    isVerified: true,
    unsubscribeTokenHash: tokenHash(token),
    preferences: { incidents: true },
    save: async () => {},
  };
  t.mock.method(StatusSubscriber, "findById", () => ({
    select: async () => unsubscribeSubscriber,
  }));
  const { readSubscriberPreferences, updateSubscriberPreferences } =
    await import("../src/services/statusNotification.service.js");
  assert.deepEqual(await readSubscriberPreferences(token), { incidents: true });
  assert.equal(
    await updateSubscriberPreferences(token, { incidents: false }),
    true,
  );
  assert.equal(unsubscribeSubscriber.preferences.incidents, false);
  assert.equal(await unsubscribe(token), true);
  assert.equal(unsubscribeSubscriber.isActive, false);
  assert.equal(await unsubscribe(`${token}tampered`), false);
});

test("notification delivery upserts use stable recipient-specific idempotency keys", async (t) => {
  const page = { slug: "acme", isPublished: true };
  const subscriber = {
    _id: "64b000000000000000000011",
    email: "a@example.com",
    preferences: { incidents: true, incidentUpdates: true },
  };
  t.mock.method(StatusPage, "findById", () => ({
    select() {
      return this;
    },
    lean: async () => page,
  }));
  t.mock.method(StatusSubscriber, "find", async () => [subscriber]);
  const batches = [];
  t.mock.method(StatusDelivery, "bulkWrite", async (operations) => {
    batches.push(operations);
    return { upsertedCount: 1 };
  });
  await enqueueStatusEvent("64b000000000000000000012", {
    eventType: "incident_created",
    subject: "Issue",
    message: "Investigating",
    eventId: "incident-1",
  });
  await enqueueStatusEvent("64b000000000000000000012", {
    eventType: "incident_created",
    subject: "Issue",
    message: "Investigating",
    eventId: "incident-1",
  });
  assert.equal(batches.length, 2);
  assert.equal(
    batches[0][0].updateOne.filter.idempotencyKey,
    "incident-1:incident_created:64b000000000000000000011",
  );
  assert.equal(
    batches[1][0].updateOne.update.$setOnInsert.idempotencyKey,
    batches[0][0].updateOne.update.$setOnInsert.idempotencyKey,
  );
  assert.equal(
    batches[0][0].updateOne.update.$setOnInsert.recipient,
    "a@example.com",
  );
});

test("notification retry schedule is bounded and errors are sanitized", () => {
  const now = Date.now();
  const retry = deliveryRetry(3, "ECONNRESET");
  assert.equal(retry.terminal, false);
  assert.equal(retry.nextAttemptAt.getTime() - now, 120_000);
  assert.equal(retry.safeError, "Email delivery failed (ECONNRESET)");
  assert.equal(deliveryRetry(5, "bad detail with token").terminal, true);
  assert.equal(
    deliveryRetry(1, "bad detail with token").safeError,
    "Email delivery failed",
  );
});

test("notification worker retries a failed delivery and stores only a safe error", async (t) => {
  t.mock.method(StatusMaintenance, "findOneAndUpdate", async () => null);
  let claimCount = 0;
  const updates = [];
  const job = {
    _id: "64b000000000000000000030",
    attempts: 1,
    statusPage: "64b000000000000000000031",
    subscriber: "64b000000000000000000032",
    updateOne: async (update) => updates.push(update),
  };
  t.mock.method(StatusDelivery, "findOneAndUpdate", () => ({
    select: async () => {
      claimCount += 1;
      return claimCount === 1 ? job : null;
    },
  }));
  t.mock.method(StatusPage, "findOne", () => {
    throw Object.assign(new Error("smtp secret"), { code: "ECONNRESET" });
  });
  await deliverBatch();
  assert.equal(updates.length, 1);
  const update = updates[0].$set;
  assert.equal(update.status, "pending");
  assert.equal(update.leaseUntil, null);
  assert.equal(update.lastError, "Email delivery failed (ECONNRESET)");
  assert.equal(JSON.stringify(update).includes("smtp secret"), false);
});

test("monitor incidents create sanitized public incidents only for visible associated services", async (t) => {
  const ownerId = "64b000000000000000000001";
  const monitorId = "64b000000000000000000020";
  const pageId = "64b000000000000000000021";
  const serviceId = "64b000000000000000000022";
  t.mock.method(Monitor, "findById", () => ({
    select() {
      return this;
    },
    lean: async () => ({
      _id: monitorId,
      owner: ownerId,
      name: "Private monitor",
    }),
  }));
  t.mock.method(StatusPage, "find", () => ({
    lean: async () => [
      {
        _id: pageId,
        isPublished: false,
        services: [
          {
            _id: serviceId,
            monitor: monitorId,
            displayName: "Public API",
            isVisible: true,
          },
        ],
      },
    ],
  }));
  t.mock.method(StatusIncident, "findOne", async () => null);
  let createData;
  t.mock.method(StatusIncident, "create", async (data) => {
    createData = data;
    return data;
  });
  await syncMonitorIncident(
    {
      _id: "64b000000000000000000023",
      monitor: monitorId,
      status: "ongoing",
      severity: "critical",
      rootCause: "private host details",
      startedAt: new Date(),
    },
    "opened",
  );
  assert.equal(createData.title, "Public API incident");
  assert.deepEqual(createData.affectedServices, [serviceId]);
  assert.equal(createData.isPublished, false);
  assert.equal(
    JSON.stringify(createData).includes("private host details"),
    false,
  );
});

test("management APIs enforce permissions while public status routes remain unauthenticated", async (t) => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { role: "UNPRIVILEGED" };
    next();
  });
  app.use("/api/status-pages", statusPageRoutes);
  app.use("/api/public/status", publicStatusRoutes);
  app.use(errorHandler);
  const server = app.listen(0);
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await new Promise((resolve) => server.once("listening", resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  for (const [path, options] of [
    ["/api/status-pages", { method: "GET" }],
    [
      "/api/status-pages",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "x", slug: "x" }),
      },
    ],
  ]) {
    const response = await fetch(`${url}${path}`, options);
    assert.equal(response.status, 403);
  }
  const publicResponse = await fetch(`${url}/api/public/status/not_a_slug`);
  assert.equal(publicResponse.status, 400);
});
