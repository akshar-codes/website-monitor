import test from "node:test";
import assert from "node:assert/strict";
import Monitor from "../src/models/Monitor.js";
import { evaluateAssertions } from "../src/workers/assertionEvaluator.js";
import { classifyApiResult } from "../src/workers/apiClassifier.js";
import { HEALTH_STATUS, FAILURE_REASONS } from "../src/config/constants.js";
import { manualHealthCheck } from "../src/controllers/monitor.controller.js";
import ApiError from "../src/utils/ApiError.js";

test("API Assertions: Monitor schema preserves required: false across instantiation and serialization", () => {
  const monitor = new Monitor({
    name: "Optional Assertion Test API",
    url: "https://api.example.test/health",
    kind: "api",
    owner: "507f1f77bcf86cd799439011",
    interval: 60,
    apiConfig: {
      version: 1,
      method: "GET",
      assertions: [
        {
          id: "assert-opt-1",
          type: "statusCode",
          comparison: "equals",
          targetValue: 200,
          required: false,
        },
        {
          id: "assert-req-2",
          type: "responseTime",
          comparison: "less_than",
          targetValue: 500,
          required: true,
        },
        {
          id: "assert-default-3",
          type: "header",
          property: "Content-Type",
          comparison: "contains",
          targetValue: "application/json",
          // omitted required -> should default to true
        },
      ],
    },
  });

  const obj = monitor.toObject();
  const assertions = obj.apiConfig.assertions;

  assert.equal(assertions.length, 3);
  assert.equal(assertions[0].id, "assert-opt-1");
  assert.equal(
    assertions[0].required,
    false,
    "required: false must be preserved",
  );
  assert.equal(assertions[1].id, "assert-req-2");
  assert.equal(
    assertions[1].required,
    true,
    "required: true must be preserved",
  );
  assert.equal(assertions[2].id, "assert-default-3");
  assert.equal(
    assertions[2].required,
    true,
    "omitted required must default to true",
  );
});

test("API Assertions: Optional assertion failure does NOT mark monitor DOWN or trigger failure flags", () => {
  const assertions = [
    {
      id: "opt-1",
      type: "statusCode",
      comparison: "equals",
      targetValue: 201, // Actual is 200, so this fails
      required: false,
    },
    {
      id: "req-1",
      type: "header",
      property: "Content-Type",
      comparison: "contains",
      targetValue: "application/json",
      required: true,
    },
  ];

  const evalResult = evaluateAssertions(assertions, {
    httpStatus: 200,
    responseTime: 100,
    headers: { "content-type": "application/json; charset=utf-8" },
    body: "{}",
  });

  assert.equal(evalResult.summary.total, 2);
  assert.equal(evalResult.summary.passed, 1);
  assert.equal(evalResult.summary.failed, 1);
  assert.equal(
    evalResult.allPassed,
    false,
    "allPassed is false because an assertion failed",
  );
  assert.equal(
    evalResult.hasFailures,
    false,
    "hasFailures is false because only optional assertion failed",
  );
  assert.equal(evalResult.hasErrors, false);

  const classification = classifyApiResult(
    {
      transportCompleted: true,
      httpStatus: 200,
      responseTime: 100,
    },
    { expectedStatusCodes: [200] },
    evalResult,
  );

  assert.equal(
    classification.status,
    HEALTH_STATUS.UP,
    "Monitor stays UP when only optional assertion fails",
  );
  assert.equal(classification.failureReason, null);
  assert.equal(classification.diagnostics.failureCategory, "none");
});

test("API Assertions: Required failure alongside optional failure marks monitor DOWN with required failure reason", () => {
  const assertions = [
    {
      id: "opt-1",
      type: "header",
      property: "X-Informational",
      comparison: "equals",
      targetValue: "info-value",
      required: false,
    },
    {
      id: "req-1",
      type: "statusCode",
      comparison: "equals",
      targetValue: 200,
      required: true,
    },
  ];

  // Both fail
  const evalResult = evaluateAssertions(assertions, {
    httpStatus: 500,
    responseTime: 100,
    headers: { "x-informational": "other" },
    body: "{}",
  });

  assert.equal(evalResult.hasFailures, true);
  assert.equal(evalResult.summary.failed, 2);

  const classification = classifyApiResult(
    {
      transportCompleted: true,
      httpStatus: 500,
      responseTime: 100,
    },
    { expectedStatusCodes: [200, 500] },
    evalResult,
  );

  assert.equal(classification.status, HEALTH_STATUS.DOWN);
  assert.equal(classification.failureReason, FAILURE_REASONS.ASSERTION_FAILURE);
  assert.equal(classification.diagnostics.failureCategory, "assertion_failure");
  // Ensure the reported safe reason is from the required failure (statusCode), not the informational header
  assert.match(
    classification.diagnostics.safeFailureReason,
    /Status code was 500, expected 200/,
  );
});

test("API Assertions: Sensitive header secret values are redacted from contains and not_contains messages", () => {
  const SECRET_KEY = "sk_live_very_secret_998877";
  const assertions = [
    {
      id: "h-sens-1",
      type: "header",
      property: "X-Api-Key",
      comparison: "contains",
      targetValue: SECRET_KEY,
      required: true,
    },
    {
      id: "h-sens-2",
      type: "header",
      property: "Authorization",
      comparison: "not_contains",
      targetValue: SECRET_KEY,
      required: true,
    },
    {
      id: "h-normal-3",
      type: "header",
      property: "Server",
      comparison: "contains",
      targetValue: "nginx",
      required: true,
    },
  ];

  const evalResult = evaluateAssertions(assertions, {
    httpStatus: 200,
    responseTime: 50,
    headers: {
      "x-api-key": "other_key",
      authorization: `Bearer ${SECRET_KEY}`,
      server: "caddy",
    },
    body: "{}",
  });

  const res1 = evalResult.results[0]; // contains failed
  assert.equal(res1.passed, false);
  assert.equal(res1.targetValue, "[REDACTED]");
  assert.equal(res1.actualValue, "[REDACTED]");
  assert.equal(res1.message, "Header 'X-Api-Key' does not contain [REDACTED]");
  assert.equal(
    res1.message.includes(SECRET_KEY),
    false,
    "Secret key must not appear in contains failure message",
  );

  const res2 = evalResult.results[1]; // not_contains failed
  assert.equal(res2.passed, false);
  assert.equal(res2.targetValue, "[REDACTED]");
  assert.equal(res2.actualValue, "[REDACTED]");
  assert.equal(
    res2.message,
    "Header 'Authorization' unexpectedly contains [REDACTED]",
  );
  assert.equal(
    res2.message.includes(SECRET_KEY),
    false,
    "Secret key must not appear in not_contains failure message",
  );

  const res3 = evalResult.results[2]; // normal header contains failed
  assert.equal(res3.passed, false);
  assert.equal(res3.targetValue, "nginx");
  assert.equal(res3.actualValue, "caddy");
  assert.equal(res3.message, "Header 'Server' does not contain 'nginx'");
});

test("Manual Health Check: in-flight concurrent check returns 409 Conflict", async (t) => {
  const mockMonitor = {
    _id: "507f1f77bcf86cd799439011",
    name: "Test Monitor",
    owner: "507f1f77bcf86cd799439012",
  };

  // getMonitorById uses Monitor.findOne({ _id, owner })
  t.mock.method(Monitor, "findOne", () => mockMonitor);
  // runMonitorCheck uses Monitor.findById. When it returns null (e.g. check already in progress/claimed), runMonitorCheck returns null
  t.mock.method(Monitor, "findById", () => ({
    select: async () => null,
  }));

  const req = {
    params: { id: "507f1f77bcf86cd799439011" },
    user: { _id: "507f1f77bcf86cd799439012", role: "USER" },
  };
  const res = {
    status() {
      return this;
    },
    json() {
      return this;
    },
  };

  let caughtError = null;
  await new Promise((resolve) => {
    manualHealthCheck(req, res, (err) => {
      caughtError = err;
      resolve();
    });
  });

  assert.ok(
    caughtError instanceof ApiError,
    "Error must be instance of ApiError",
  );
  assert.equal(caughtError.statusCode, 409, "Must return HTTP 409 Conflict");
  assert.match(caughtError.message, /already in progress/i);
});

test("Manual Health Check: cross-tenant access is rejected via getMonitorById ownership check", async (t) => {
  // When monitor does not belong to the user, Monitor.findOne returns null
  t.mock.method(Monitor, "findOne", () => null);

  const req = {
    params: { id: "507f1f77bcf86cd799439099" },
    user: { _id: "507f1f77bcf86cd799439088", role: "USER" },
  };
  const res = {
    status() {
      return this;
    },
    json() {
      return this;
    },
  };

  let caughtError = null;
  await new Promise((resolve) => {
    manualHealthCheck(req, res, (err) => {
      caughtError = err;
      resolve();
    });
  });

  assert.ok(
    caughtError instanceof ApiError,
    "Error must be instance of ApiError",
  );
  assert.equal(
    caughtError.statusCode,
    404,
    "Must return HTTP 404 for foreign or non-existent monitor",
  );
});
