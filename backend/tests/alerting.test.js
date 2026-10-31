import test from "node:test";
import assert from "node:assert/strict";
import {
  integrationCreateSchema,
  notificationRuleSchema,
  alertPolicySchema,
  alertPolicyUpdateSchema,
  deliveryQuerySchema,
} from "../src/validators/alerting.validator.js";
import { validatePublicHttpsUrl } from "../src/services/integrations/deliveryProvider.service.js";

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
