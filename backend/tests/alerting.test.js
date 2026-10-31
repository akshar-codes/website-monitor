import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import https from "node:https";
import { createHmac, randomBytes } from "node:crypto";
import {
  integrationCreateSchema,
  notificationRuleSchema,
  alertPolicySchema,
  alertPolicyUpdateSchema,
  deliveryQuerySchema,
} from "../src/validators/alerting.validator.js";
import {
  deliverToProvider,
  validatePublicHttpsUrl,
} from "../src/services/integrations/deliveryProvider.service.js";
import { encryptCredential } from "../src/utils/credentialEncryption.js";
import env from "../src/config/env.js";
import Notification from "../src/models/Notification.js";
import NotificationRule from "../src/models/NotificationRule.js";
import NotificationIntegration from "../src/models/NotificationIntegration.js";
import NotificationDelivery from "../src/models/NotificationDelivery.js";
import Incident from "../src/models/Incident.js";
import RegionalIncident from "../src/models/RegionalIncident.js";
import {
  TYPE_TO_EVENT,
  enqueueNotificationAlert,
  processNotificationDeliveryBatch,
  processEscalationBatch,
} from "../src/services/alerting/alerting.service.js";
import AlertEscalationExecution from "../src/models/AlertEscalationExecution.js";
import AlertAcknowledgement from "../src/models/AlertAcknowledgement.js";
import AlertPolicy from "../src/models/AlertPolicy.js";
import {
  ALERTABLE_NOTIFICATION_TYPES,
  createNotification,
} from "../src/services/notification.service.js";

test("integration inputs accept configured providers and reject provider URL spoofing", () => {
  assert.equal(
    integrationCreateSchema.safeParse({
      name: "Ops Slack",
      provider: "slack",
      webhookUrl: "https://hooks.slack.com/services/T/B/secret",
    }).success,
    true,
  );
  assert.equal(
    integrationCreateSchema.safeParse({
      name: "Spoofed Slack",
      provider: "slack",
      webhookUrl:
        "https://hooks.slack.com.attacker.invalid/services/T/B/secret",
    }).success,
    false,
  );
  assert.equal(
    integrationCreateSchema.safeParse({
      name: "Bad Discord",
      provider: "discord",
      webhookUrl: "https://evil.example/api/webhooks/123/token",
    }).success,
    false,
  );
});

test("notification rule schema accepts known events and rejects unexpected fields", () => {
  const good = notificationRuleSchema.safeParse({
    name: "Incidents",
    integrationIds: ["64b000000000000000000001"],
    events: ["incident.created", "incident.resolved"],
    filters: {},
    isActive: true,
  });
  assert.equal(good.success, true);
  assert.equal(
    notificationRuleSchema.safeParse({
      name: "Unexpected",
      integrationIds: [],
      events: ["anything"],
      secret: "no",
    }).success,
    false,
  );
});

test("escalation policies require strictly increasing bounded delays", () => {
  const base = {
    name: "Production",
    triggerEvents: ["incident.created"],
    initialIntegrationIds: ["64b000000000000000000001"],
    escalationSteps: [
      { afterMinutes: 5, integrationIds: ["64b000000000000000000002"] },
      { afterMinutes: 15, integrationIds: ["64b000000000000000000003"] },
    ],
    repeatPolicy: {
      enabled: true,
      intervalMinutes: 30,
      maxRepeats: 2,
      integrationIds: [],
    },
  };
  assert.equal(alertPolicySchema.safeParse(base).success, true);
  assert.equal(
    alertPolicySchema.safeParse({
      ...base,
      escalationSteps: [...base.escalationSteps].reverse(),
    }).success,
    false,
  );
  assert.equal(
    alertPolicySchema.safeParse({
      ...base,
      escalationSteps: [{ afterMinutes: 0, integrationIds: [] }],
    }).success,
    false,
  );
  assert.equal(
    alertPolicyUpdateSchema.safeParse({
      escalationSteps: [...base.escalationSteps].reverse(),
    }).success,
    false,
  );
  assert.equal(alertPolicyUpdateSchema.safeParse({}).success, false);
});

test("custom webhook headers are constrained and reject reserved or unsafe values", () => {
  const base = {
    name: "Custom",
    provider: "webhook",
    endpointUrl: "https://hooks.example.com/sitewatch",
    signingSecret: "a-secure-signing-secret-with-enough-length",
  };
  assert.equal(
    integrationCreateSchema.safeParse({
      ...base,
      customHeaders: { "X-Environment": "production" },
    }).success,
    true,
  );
  assert.equal(
    integrationCreateSchema.safeParse({
      ...base,
      customHeaders: { Authorization: "Bearer token" },
    }).success,
    false,
  );
  assert.equal(
    integrationCreateSchema.safeParse({
      ...base,
      customHeaders: { "X-SiteWatch-Event": "spoofed" },
    }).success,
    false,
  );
  assert.equal(
    integrationCreateSchema.safeParse({
      ...base,
      customHeaders: { "X-Environment": "line1\r\nInjected: true" },
    }).success,
    false,
  );
});

test("delivery history filters reject invalid ranges", () => {
  assert.equal(
    deliveryQuerySchema.safeParse({ provider: "slack", status: "delivered" })
      .success,
    true,
  );
  assert.equal(
    deliveryQuerySchema.safeParse({
      startDate: "2026-11-02",
      endDate: "2026-11-01",
    }).success,
    false,
  );
});

test("webhook destinations require HTTPS and reject private and loopback addresses", async () => {
  await assert.rejects(
    validatePublicHttpsUrl("http://example.com/hook"),
    /HTTPS/,
  );
  await assert.rejects(
    validatePublicHttpsUrl("https://127.0.0.1/hook"),
    /restricted/,
  );
  await assert.rejects(
    validatePublicHttpsUrl("https://[::1]/hook"),
    /restricted/,
  );
});

test("custom webhook provider dispatch sends signed JSON over HTTPS", async (t) => {
  const previousKey = env.ALERT_CREDENTIAL_ENCRYPTION_KEY;
  env.ALERT_CREDENTIAL_ENCRYPTION_KEY = randomBytes(32).toString("hex");
  let requestOptions;
  let body = "";
  t.mock.method(https, "request", (options, callback) => {
    requestOptions = options;
    const request = new EventEmitter();
    request.write = (chunk) => {
      body += chunk;
    };
    request.end = () => {
      const response = new EventEmitter();
      response.statusCode = 204;
      response.setEncoding = () => {};
      queueMicrotask(() => {
        callback(response);
        response.emit("end");
      });
    };
    request.destroy = (error) => request.emit("error", error);
    return request;
  });

  try {
    const secret = "long-enough-custom-webhook-signing-secret";
    const result = await deliverToProvider(
      {
        provider: "webhook",
        config: { endpointUrl: "https://1.1.1.1/sitewatch" },
        credentials: {
          signingSecret: encryptCredential(secret),
          customHeaders: encryptCredential(
            JSON.stringify({ "X-Environment": "test" }),
          ),
        },
      },
      {
        eventId: "event-42",
        type: "regional.outage",
        title: "Regional outage",
        message: "Probe failures",
      },
    );
    const timestamp = requestOptions.headers["x-sitewatch-timestamp"];
    const signature = createHmac("sha256", secret)
      .update(`${timestamp}.${body}`)
      .digest("hex");

    assert.equal(result.status, 204);
    assert.equal(requestOptions.protocol, "https:");
    assert.equal(requestOptions.hostname, "1.1.1.1");
    assert.equal(requestOptions.headers["X-Environment"], "test");
    assert.equal(
      requestOptions.headers["x-sitewatch-event"],
      "regional.outage",
    );
    assert.equal(requestOptions.headers["x-sitewatch-delivery"], "event-42");
    assert.equal(
      requestOptions.headers["x-sitewatch-signature"],
      `sha256=${signature}`,
    );
    assert.deepEqual(JSON.parse(body), {
      id: "event-42",
      type: "regional.outage",
      createdAt: JSON.parse(body).createdAt,
      data: {
        title: "Regional outage",
        message: "Probe failures",
        monitorId: null,
        incidentId: null,
        severity: null,
        priority: "normal",
        link: null,
      },
    });
  } finally {
    env.ALERT_CREDENTIAL_ENCRYPTION_KEY = previousKey;
  }
});

test("performance and regional notifications map to external alert events", async (t) => {
  const owner = "64b000000000000000000010";
  const integrationId = "64b000000000000000000011";
  const monitorId = "64b000000000000000000012";
  const mappings = {
    performance_degraded: "performance.degraded",
    performance_recovered: "performance.recovered",
    regional_outage: "regional.outage",
    regional_recovered: "regional.recovered",
    regional_performance_degraded: "regional.performance_degraded",
    global_outage_confirmed: "global.outage_confirmed",
  };
  const queued = [];
  t.mock.method(NotificationRule, "find", (filter) => ({
    lean: async () => [
      { integrationIds: [integrationId], filters: {}, events: [filter.events] },
    ],
  }));
  t.mock.method(NotificationIntegration, "find", async () => [
    { _id: integrationId },
  ]);
  t.mock.method(NotificationDelivery, "updateOne", async (_filter, update) => {
    queued.push(update.$setOnInsert);
  });
  t.mock.method(Notification, "updateOne", async () => ({}));
  const resourceQuery = (value) => ({
    select() {
      return this;
    },
    lean: async () => value,
  });
  t.mock.method(Incident, "findById", () =>
    resourceQuery({ monitor: monitorId, severity: "critical" }),
  );
  t.mock.method(RegionalIncident, "findById", () =>
    resourceQuery({ monitor: monitorId }),
  );

  for (const [type, eventType] of Object.entries(mappings)) {
    assert.deepEqual(TYPE_TO_EVENT[type], [eventType]);
    assert.ok(ALERTABLE_NOTIFICATION_TYPES.has(type));
    assert.equal(
      notificationRuleSchema.safeParse({
        name: type,
        integrationIds: [],
        events: [eventType],
        filters: {},
      }).success,
      true,
    );
    await enqueueNotificationAlert({
      _id: `${type}-event`,
      owner,
      type,
      title: type,
      message: `Test ${type}`,
      priority: "high",
      relatedResource: {
        resourceType:
          type === "global_outage_confirmed"
            ? "Incident"
            : type.startsWith("regional_")
              ? "RegionalIncident"
              : "Monitor",
        resourceId: "64b000000000000000000013",
      },
      ...(type.startsWith("performance_")
        ? {
            relatedResource: { resourceType: "Monitor", resourceId: monitorId },
          }
        : {}),
    });
  }

  assert.deepEqual(
    queued.map((delivery) => delivery.eventType),
    Object.values(mappings),
  );
  assert.ok(
    queued.every((delivery) => delivery.payload.monitorId === monitorId),
  );
});

test("delivery worker dispatches, retries transient errors, then records success", async (t) => {
  const now = new Date("2026-11-01T12:00:00.000Z");
  const row = {
    _id: "delivery-1",
    owner: "owner-1",
    integration: "integration-1",
    eventId: "event-1",
    eventType: "performance.degraded",
    payload: { type: "performance.degraded" },
    status: "pending",
    attempts: 0,
    nextRetryAt: now,
  };
  let dispatchCount = 0;
  let claimNow = now;
  const updates = [];
  t.mock.method(
    NotificationDelivery,
    "findOneAndUpdate",
    async (_filter, update) => {
      if (
        !["pending", "failed"].includes(row.status) ||
        row.nextRetryAt > claimNow
      )
        return null;
      row.status = "processing";
      row.attempts += update.$inc.attempts;
      return { ...row };
    },
  );
  t.mock.method(NotificationDelivery, "updateOne", async (_filter, update) => {
    Object.assign(row, update.$set);
    updates.push({ ...update.$set });
  });
  t.mock.method(NotificationIntegration, "findOne", () => ({
    select: async () => ({ provider: "slack" }),
  }));
  t.mock.method(NotificationIntegration, "updateOne", async () => ({}));
  const dispatch = async () => {
    dispatchCount += 1;
    if (dispatchCount === 1) {
      const error = new Error("upstream unavailable");
      error.status = 503;
      throw error;
    }
  };

  const failure = await processNotificationDeliveryBatch({ now, dispatch });
  assert.deepEqual(failure, { delivered: 0, failed: 1 });
  assert.equal(row.status, "failed");
  assert.equal(row.error, "Provider returned HTTP 503");
  assert.ok(row.nextRetryAt > now);

  const retryAt = new Date(row.nextRetryAt.getTime() + 1);
  claimNow = retryAt;
  const success = await processNotificationDeliveryBatch({
    now: retryAt,
    dispatch,
  });
  assert.deepEqual(success, { delivered: 1, failed: 0 });
  assert.equal(dispatchCount, 2);
  assert.equal(row.status, "delivered");
  assert.equal(row.attempts, 2);
  assert.equal(updates.at(-1).status, "delivered");
});

test("escalation worker queues the due step and schedules the next persisted step", async (t) => {
  const owner = "owner-1";
  const integrationId = "integration-2";
  const startedAt = new Date("2026-11-01T10:00:00.000Z");
  const execution = {
    _id: "execution-1",
    owner,
    policy: "policy-1",
    incident: "incident-1",
    eventId: "event-1",
    status: "pending",
    startedAt,
    currentStep: 0,
    repeatCount: 0,
    save: async () => {},
  };
  let claimed = false;
  const deliveryRows = [];
  t.mock.method(AlertEscalationExecution, "findOneAndUpdate", async () => {
    if (claimed) return null;
    claimed = true;
    return execution;
  });
  t.mock.method(AlertPolicy, "findOne", () => ({
    lean: async () => ({
      isActive: true,
      escalationSteps: [
        {
          afterMinutes: 5,
          integrationIds: [integrationId],
          priority: "critical",
        },
        { afterMinutes: 15, integrationIds: [integrationId], priority: "high" },
      ],
      repeatPolicy: { enabled: false },
    }),
  }));
  t.mock.method(Incident, "findById", () => ({
    populate() {
      return this;
    },
    lean: async () => ({
      _id: "incident-1",
      status: "ongoing",
      severity: "major",
      monitor: { _id: "monitor-1", owner, name: "Production API" },
    }),
  }));
  t.mock.method(AlertAcknowledgement, "findOne", () => ({
    lean: async () => null,
  }));
  t.mock.method(NotificationIntegration, "find", () => ({
    select() {
      return this;
    },
    lean: async () => [{ _id: integrationId }],
  }));
  t.mock.method(NotificationDelivery, "updateOne", async (_filter, update) =>
    deliveryRows.push(update.$setOnInsert),
  );

  const now = new Date("2026-11-01T10:05:00.000Z");
  const result = await processEscalationBatch({ now });
  assert.deepEqual(result, { processed: 1 });
  assert.equal(deliveryRows.length, 1);
  assert.equal(deliveryRows[0].eventType, "incident.created");
  assert.equal(deliveryRows[0].payload.priority, "critical");
  assert.equal(execution.currentStep, 1);
  assert.equal(execution.status, "pending");
  assert.equal(execution.nextRunAt.toISOString(), "2026-11-01T10:15:00.000Z");
});

test("acknowledged incident cancels escalation before another destination is queued", async (t) => {
  const owner = "owner-1";
  const execution = {
    _id: "execution-2",
    owner,
    policy: "policy-1",
    incident: "incident-2",
    eventId: "event-2",
    status: "pending",
    startedAt: new Date(),
    currentStep: 0,
    repeatCount: 0,
    save: async () => {},
  };
  let claimed = false;
  let integrationLookup = 0;
  t.mock.method(AlertEscalationExecution, "findOneAndUpdate", async () => {
    if (claimed) return null;
    claimed = true;
    return execution;
  });
  t.mock.method(AlertPolicy, "findOne", () => ({
    lean: async () => ({
      isActive: true,
      escalationSteps: [{ afterMinutes: 5, integrationIds: ["integration-3"] }],
    }),
  }));
  t.mock.method(Incident, "findById", () => ({
    populate() {
      return this;
    },
    lean: async () => ({
      _id: "incident-2",
      status: "ongoing",
      monitor: { _id: "monitor-1", owner, name: "Production API" },
    }),
  }));
  t.mock.method(AlertAcknowledgement, "findOne", () => ({
    lean: async () => ({ acknowledgedAt: new Date() }),
  }));
  t.mock.method(NotificationIntegration, "find", async () => {
    integrationLookup += 1;
    return [];
  });

  const result = await processEscalationBatch({ now: new Date() });
  assert.deepEqual(result, { processed: 0 });
  assert.equal(execution.status, "acknowledged");
  assert.equal(integrationLookup, 0);
});

test("incident events with no in-app preferences remain available to alert integrations", async (t) => {
  const { default: UserPreference } =
    await import("../src/models/UserPreference.js");
  const allTypes = [
    "performance_degraded",
    "performance_recovered",
    "regional_outage",
    "regional_recovered",
    "regional_performance_degraded",
    "global_outage_confirmed",
  ];
  let persisted = 0;
  t.mock.method(UserPreference, "getOrCreateForUser", async () => ({
    notifications: {
      toObject: () => ({
        inApp: {
          monitorDown: false,
          monitorRecovery: false,
          performanceAlerts: false,
          regionalMonitoring: false,
          incidents: false,
        },
        email: { enabled: false },
        frequency: "immediate",
      }),
    },
  }));
  t.mock.method(Notification, "create", async (data) => {
    persisted += 1;
    return {
      ...data,
      channels: { inApp: {}, email: {}, push: {} },
      save: async () => ({}),
    };
  });

  for (const type of allTypes) {
    const result = await createNotification({
      ownerId: "user-1",
      type,
      title: type,
      message: "Alert",
    });
    assert.ok(result, `${type} is persisted for the alerting dispatcher`);
  }
  assert.equal(persisted, allTypes.length);
});
