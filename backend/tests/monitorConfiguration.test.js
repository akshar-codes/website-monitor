import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import Monitor from "../src/models/Monitor.js";
import {
  createMonitorSchema,
  updateMonitorSchema,
} from "../src/validators/monitor.validator.js";
import { FEATURES, hasFeature } from "../src/config/features.js";
import { getPlanDefinition } from "../src/config/plans.js";
import {
  assertApiMonitorAllowed,
  countOwnedApiMonitors,
  secureApiConfig,
} from "../src/services/monitor.service.js";
import { decryptCredential } from "../src/utils/credentialEncryption.js";
import env from "../src/config/env.js";

const validApi = (overrides = {}) => ({
  name: "Orders API",
  url: "https://api.example.test/orders",
  kind: "api",
  apiConfig: { method: "GET", ...overrides },
});

test("legacy monitor documents default to website kind", () => {
  const monitor = new Monitor({
    name: "Website",
    url: "https://example.test",
    owner: "507f1f77bcf86cd799439011",
    interval: 300,
  });
  assert.equal(monitor.kind, "website");
  assert.equal(monitor.apiConfig, undefined);
});

test("API monitor configuration accepts supported methods and bounded defaults", () => {
  for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE"]) {
    const parsed = createMonitorSchema.safeParse({
      ...validApi(),
      apiConfig: { method },
    });
    assert.equal(parsed.success, true, method);
    assert.equal(parsed.data.apiConfig.version, 1);
    assert.deepEqual(parsed.data.apiConfig.expectedStatusCodes, [200]);
  }
});

test("API monitor validation rejects credentials in URLs, unsafe headers, invalid statuses and unknown fields", () => {
  assert.equal(
    createMonitorSchema.safeParse({
      ...validApi(),
      url: "https://user:pass@example.test",
    }).success,
    false,
  );
  assert.equal(
    createMonitorSchema.safeParse({
      ...validApi(),
      url: "https://api.example.test?access_token=secret",
    }).success,
    false,
  );
  assert.equal(
    createMonitorSchema.safeParse({
      ...validApi(),
      apiConfig: { method: "GET", headers: { Host: "internal" } },
    }).success,
    false,
  );
  assert.equal(
    createMonitorSchema.safeParse({
      ...validApi(),
      apiConfig: { method: "GET", headers: { "x-test": "a\r\nb" } },
    }).success,
    false,
  );
  assert.equal(
    createMonitorSchema.safeParse({
      ...validApi(),
      apiConfig: { method: "GET", expectedStatusCodes: [99] },
    }).success,
    false,
  );
  assert.equal(
    createMonitorSchema.safeParse({
      ...validApi(),
      apiConfig: { method: "GET", unexpected: true },
    }).success,
    false,
  );
  assert.equal(
    createMonitorSchema.safeParse({ ...validApi(), unexpected: true }).success,
    false,
  );
});

test("API monitor validation enforces body, auth, query and response-time constraints", () => {
  assert.equal(
    createMonitorSchema.safeParse({
      ...validApi(),
      apiConfig: { method: "GET", body: "{}" },
    }).success,
    false,
  );
  assert.equal(
    createMonitorSchema.safeParse({
      ...validApi(),
      apiConfig: { method: "POST", authentication: { mode: "bearer" } },
    }).success,
    false,
  );
  assert.equal(
    createMonitorSchema.safeParse({
      ...validApi(),
      apiConfig: {
        method: "POST",
        authentication: { mode: "basic", username: "user", password: "pw" },
      },
    }).success,
    true,
  );
  assert.equal(
    createMonitorSchema.safeParse({
      ...validApi(),
      apiConfig: { method: "GET", maxResponseTimeMs: 120001 },
    }).success,
    false,
  );
  assert.equal(
    createMonitorSchema.safeParse({
      ...validApi(),
      apiConfig: { method: "GET", queryParams: { key: 42 } },
    }).success,
    false,
  );
  const tooManyParams = Object.fromEntries(
    Array.from({ length: 31 }, (_, index) => [`q${index}`, "value"]),
  );
  const tooManyHeaders = Object.fromEntries(
    Array.from({ length: 31 }, (_, index) => [`x-test-${index}`, "value"]),
  );
  assert.equal(
    createMonitorSchema.safeParse({
      ...validApi(),
      apiConfig: { method: "GET", queryParams: tooManyParams },
    }).success,
    false,
  );
  assert.equal(
    createMonitorSchema.safeParse({
      ...validApi(),
      apiConfig: { method: "GET", headers: tooManyHeaders },
    }).success,
    false,
  );
  assert.equal(
    createMonitorSchema.safeParse({
      ...validApi(),
      apiConfig: { method: "POST", body: "x".repeat(65537) },
    }).success,
    false,
  );
  assert.equal(
    updateMonitorSchema.safeParse({
      apiConfig: { method: "GET", unknown: "field" },
    }).success,
    false,
  );
});

test("legacy website forms retain their ignored method field while API method stays nested", () => {
  assert.equal(
    createMonitorSchema.safeParse({
      name: "Website",
      url: "https://example.test",
      method: "POST",
    }).success,
    true,
  );
  assert.equal(updateMonitorSchema.safeParse({ method: "GET" }).success, true);
  assert.equal(
    createMonitorSchema.safeParse({
      ...validApi(),
      method: "POST",
    }).success,
    false,
  );
});

test("API credentials are masked by monitor serialization", () => {
  const monitor = new Monitor({
    name: "Private API",
    url: "https://api.example.test",
    owner: "507f1f77bcf86cd799439011",
    interval: 300,
    kind: "api",
    apiConfig: {
      method: "GET",
      headers: { "x-api-key": "stored-secret", accept: "application/json" },
      queryParams: { access_token: "query-secret", page: "1" },
      secretHeaderNames: ["x-api-key"],
      secretQueryParamNames: ["access_token"],
      bodyConfigured: true,
      encryptedBody: "v1:iv:tag:body-ciphertext",
      authentication: {
        mode: "bearer",
        credentialConfigured: true,
        credentialCiphertext: "v1:iv:tag:ciphertext",
      },
    },
  });
  const serialized = JSON.stringify(monitor);
  assert.equal(serialized.includes("ciphertext"), false);
  assert.equal(serialized.includes("stored-secret"), false);
  assert.equal(serialized.includes("query-secret"), false);
  assert.equal(serialized.includes("body-ciphertext"), false);
  assert.equal(serialized.includes("credentialCiphertext"), false);
  assert.equal(monitor.toJSON().apiConfig.authentication.configured, true);
  assert.equal(monitor.toJSON().apiConfig.headers["x-api-key"], "********");
  assert.equal(monitor.toJSON().apiConfig.queryParams.access_token, "********");
  assert.equal(monitor.toJSON().apiConfig.headers.accept, "application/json");
  assert.equal(monitor.toJSON().apiConfig.queryParams.page, "1");
  assert.equal(monitor.toJSON().apiConfig.bodyConfigured, true);
  assert.equal("body" in monitor.toJSON().apiConfig, false);
});

test("API credentials are encrypted, preserved on omitted updates, replaceable and removable", () => {
  const previousKey = env.ALERT_CREDENTIAL_ENCRYPTION_KEY;
  env.ALERT_CREDENTIAL_ENCRYPTION_KEY = randomBytes(32).toString("hex");
  try {
    const created = secureApiConfig({
      method: "GET",
      body: '{"password":"body-secret"}',
      headers: { "x-api-key": "header-secret", accept: "application/json" },
      queryParams: { access_token: "query-secret", page: "1" },
      authentication: { mode: "bearer", token: "first-secret" },
    });
    const encrypted = created.authentication.credentialCiphertext;
    assert.ok(encrypted.startsWith("v1:"));
    assert.notEqual(encrypted, "first-secret");
    assert.equal(decryptCredential(encrypted), "first-secret");
    assert.equal(
      decryptCredential(created.encryptedBody),
      '{"password":"body-secret"}',
    );
    assert.equal(created.headers.accept, "application/json");
    assert.equal(created.headers["x-api-key"], undefined);
    assert.equal(
      decryptCredential(created.encryptedHeaders["x-api-key"]),
      "header-secret",
    );
    assert.equal(
      decryptCredential(created.encryptedQueryParams.access_token),
      "query-secret",
    );
    assert.equal(created.queryParams.page, "1");

    const preserved = secureApiConfig({ method: "GET" }, created);
    assert.equal(preserved.authentication.credentialCiphertext, encrypted);
    assert.equal(preserved.encryptedBody, created.encryptedBody);
    assert.equal(
      preserved.encryptedHeaders["x-api-key"],
      created.encryptedHeaders["x-api-key"],
    );

    const replaced = secureApiConfig(
      {
        method: "GET",
        authentication: { mode: "bearer", token: "second-secret" },
      },
      created,
    );
    assert.notEqual(replaced.authentication.credentialCiphertext, encrypted);
    assert.equal(
      decryptCredential(replaced.authentication.credentialCiphertext),
      "second-secret",
    );

    const removed = secureApiConfig(
      { method: "GET", authentication: { mode: "none" } },
      created,
    );
    assert.equal(removed.authentication.credentialConfigured, false);
    assert.equal(removed.authentication.credentialCiphertext, null);
    const bodyRemoved = secureApiConfig(
      { method: "POST", body: null },
      created,
    );
    assert.equal(bodyRemoved.bodyConfigured, false);
    assert.equal(bodyRemoved.encryptedBody, null);
  } finally {
    env.ALERT_CREDENTIAL_ENCRYPTION_KEY = previousKey;
  }
});

test("API monitor access is explicitly plan-limited", () => {
  assert.equal(getPlanDefinition("free").limits.maxApiMonitors, 0);
  assert.equal(hasFeature("free", FEATURES.API_MONITORING), false);
  assert.equal(getPlanDefinition("pro").limits.maxApiMonitors, 5);
  assert.equal(hasFeature("pro", FEATURES.API_MONITORING), true);
  assert.equal(getPlanDefinition("unlimited").limits.maxApiMonitors, 25);
});

test("API monitor counts are owner- and kind-scoped and limits reject create attempts", async () => {
  const owner = "owner-1";
  let filter;
  await countOwnedApiMonitors({ id: owner }, "monitor-1", {
    countDocuments(value) {
      filter = value;
      return Promise.resolve(4);
    },
  });
  assert.deepEqual(filter, {
    owner,
    kind: "api",
    _id: { $ne: "monitor-1" },
  });

  await assert.rejects(
    assertApiMonitorAllowed(
      { id: owner, plan: "free" },
      undefined,
      async () => 0,
    ),
    (error) => error.code === "FEATURE_RESTRICTED",
  );
  await assert.rejects(
    assertApiMonitorAllowed(
      { id: owner, plan: "pro" },
      undefined,
      async () => 5,
    ),
    (error) => error.code === "UPGRADE_REQUIRED",
  );
});
