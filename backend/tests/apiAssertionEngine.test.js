import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { evaluateAssertions } from "../src/workers/assertionEvaluator.js";
import { classifyApiResult } from "../src/workers/apiClassifier.js";
import { HEALTH_STATUS, FAILURE_REASONS } from "../src/config/constants.js";
import HealthCheck from "../src/models/HealthCheck.js";

test("API Assertions: status code assertions evaluate equality and inequality", () => {
  const assertions = [
    {
      id: "assert-1",
      type: "statusCode",
      comparison: "equals",
      targetValue: 200,
    },
    {
      id: "assert-2",
      type: "statusCode",
      comparison: "not_equals",
      targetValue: 500,
    },
    {
      id: "assert-3",
      type: "statusCode",
      comparison: "equals",
      targetValue: 201,
    },
  ];

  const evalResult = evaluateAssertions(assertions, {
    httpStatus: 200,
    responseTime: 120,
    headers: {},
    body: "OK",
  });

  assert.equal(evalResult.summary.total, 3);
  assert.equal(evalResult.summary.passed, 2);
  assert.equal(evalResult.summary.failed, 1);
  assert.equal(evalResult.summary.errors, 0);
  assert.equal(evalResult.allPassed, false);
  assert.equal(evalResult.hasFailures, true);
  assert.equal(evalResult.results[0].passed, true);
  assert.equal(evalResult.results[1].passed, true);
  assert.equal(evalResult.results[2].passed, false);
  assert.match(
    evalResult.results[2].message,
    /Status code was 200, expected 201/,
  );
});

test("API Assertions: response time assertions evaluate thresholds", () => {
  const assertions = [
    {
      id: "rt-1",
      type: "responseTime",
      comparison: "less_than",
      targetValue: 500,
    },
    {
      id: "rt-2",
      type: "responseTime",
      comparison: "greater_than",
      targetValue: 50,
    },
    {
      id: "rt-3",
      type: "responseTime",
      comparison: "less_than",
      targetValue: 100,
    },
  ];

  const evalResult = evaluateAssertions(assertions, {
    httpStatus: 200,
    responseTime: 250,
    headers: {},
    body: "",
  });

  assert.equal(evalResult.summary.total, 3);
  assert.equal(evalResult.results[0].passed, true);
  assert.equal(evalResult.results[1].passed, true);
  assert.equal(evalResult.results[2].passed, false);
  assert.match(evalResult.results[2].message, /exceeded threshold/);
});

test("API Assertions: header assertions perform case-insensitive checks", () => {
  const assertions = [
    {
      id: "h-1",
      type: "header",
      property: "Content-Type",
      comparison: "contains",
      targetValue: "application/json",
    },
    {
      id: "h-2",
      type: "header",
      property: "x-request-id",
      comparison: "exists",
    },
    {
      id: "h-3",
      type: "header",
      property: "X-Missing-Header",
      comparison: "not_exists",
    },
    {
      id: "h-4",
      type: "header",
      property: "server",
      comparison: "equals",
      targetValue: "nginx",
    },
  ];

  const evalResult = evaluateAssertions(assertions, {
    httpStatus: 200,
    responseTime: 80,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "X-Request-Id": "req-999",
      SERVER: "nginx",
    },
    body: "{}",
  });

  assert.equal(evalResult.summary.total, 4);
  assert.equal(evalResult.allPassed, true);
  assert.equal(evalResult.hasFailures, false);
});

test("API Assertions: body text assertions evaluate containment and boundaries", () => {
  const assertions = [
    {
      id: "b-1",
      type: "bodyText",
      comparison: "contains",
      targetValue: "success",
    },
    {
      id: "b-2",
      type: "bodyText",
      comparison: "starts_with",
      targetValue: "STATUS:",
    },
    {
      id: "b-3",
      type: "bodyText",
      comparison: "not_contains",
      targetValue: "INTERNAL_ERROR",
    },
  ];

  const evalResult = evaluateAssertions(assertions, {
    httpStatus: 200,
    responseTime: 90,
    headers: {},
    body: "STATUS: success - all systems green",
  });

  assert.equal(evalResult.allPassed, true);
  assert.equal(evalResult.summary.passed, 3);
});

test("API Assertions: JSONPath evaluations verify paths, types, values, and missing nodes safely", () => {
  const jsonBody = JSON.stringify({
    status: "ok",
    code: 200,
    active: true,
    data: {
      user: {
        id: 42,
        name: "Alice",
        tags: ["admin", "staff"],
        meta: null,
      },
      emptyList: [],
    },
  });

  const assertions = [
    {
      id: "jp-1",
      type: "jsonPath",
      property: "$.status",
      comparison: "equals",
      targetValue: "ok",
    },
    {
      id: "jp-2",
      type: "jsonPath",
      property: "$.data.user.id",
      comparison: "is_number",
    },
    {
      id: "jp-3",
      type: "jsonPath",
      property: "$.data.user.tags",
      comparison: "is_array",
    },
    {
      id: "jp-4",
      type: "jsonPath",
      property: "$.data.user.tags",
      comparison: "contains",
      targetValue: "admin",
    },
    {
      id: "jp-5",
      type: "jsonPath",
      property: "$.data.user.meta",
      comparison: "is_null",
    },
    {
      id: "jp-6",
      type: "jsonPath",
      property: "$.data.emptyList",
      comparison: "is_empty",
    },
    {
      id: "jp-7",
      type: "jsonPath",
      property: "$.missing.path",
      comparison: "not_exists",
    },
    {
      id: "jp-8",
      type: "jsonPath",
      property: "$.missing.path",
      comparison: "exists",
    },
  ];

  const evalResult = evaluateAssertions(assertions, {
    httpStatus: 200,
    responseTime: 110,
    headers: { "content-type": "application/json" },
    body: jsonBody,
  });

  assert.equal(evalResult.summary.total, 8);
  assert.equal(evalResult.summary.passed, 7);
  assert.equal(evalResult.summary.failed, 1);
  assert.equal(evalResult.results[7].passed, false);
  assert.match(evalResult.results[7].message, /did not match any values/);
});

test("API Assertions: JSONPath evaluation returns error outcome when body is not valid JSON", () => {
  const assertions = [
    {
      id: "jp-err",
      type: "jsonPath",
      property: "$.data.id",
      comparison: "exists",
    },
  ];

  const evalResult = evaluateAssertions(assertions, {
    httpStatus: 200,
    responseTime: 100,
    headers: { "content-type": "text/html" },
    body: "<html><body>Not JSON</body></html>",
  });

  assert.equal(evalResult.summary.errors, 1);
  assert.equal(evalResult.hasErrors, true);
  assert.equal(evalResult.results[0].outcome, "error");
  assert.match(evalResult.results[0].message, /not valid JSON/);
});

test("API Assertions: JSON Schema draft-7 validation verifies payload contracts and reports failures", () => {
  const schema = {
    type: "object",
    required: ["id", "email", "roles"],
    properties: {
      id: { type: "integer" },
      email: { type: "string" },
      roles: {
        type: "array",
        items: { type: "string" },
        minItems: 1,
      },
    },
  };

  const validBody = JSON.stringify({
    id: 101,
    email: "user@example.com",
    roles: ["operator"],
  });

  const invalidBody = JSON.stringify({
    id: "not-an-int",
    email: "user@example.com",
    roles: [],
  });

  const validResult = evaluateAssertions(
    [
      {
        id: "schema-1",
        type: "jsonSchema",
        comparison: "matches_schema",
        targetValue: schema,
      },
    ],
    {
      httpStatus: 200,
      responseTime: 120,
      headers: {},
      body: validBody,
    },
  );

  assert.equal(validResult.allPassed, true);
  assert.equal(validResult.results[0].outcome, "passed");

  const invalidResult = evaluateAssertions(
    [
      {
        id: "schema-2",
        type: "jsonSchema",
        comparison: "matches_schema",
        targetValue: schema,
      },
    ],
    {
      httpStatus: 200,
      responseTime: 120,
      headers: {},
      body: invalidBody,
    },
  );

  assert.equal(invalidResult.allPassed, false);
  assert.equal(invalidResult.summary.failed, 1);
  assert.equal(invalidResult.results[0].outcome, "failed");
  assert.match(invalidResult.results[0].message, /validation failed/);
});

test("Classification Contract: assertion failures classify as down with assertion_failure", () => {
  const rawResult = {
    transportCompleted: true,
    httpStatus: 200,
    responseTime: 150,
    headers: {},
  };

  const failedAssertionEval = {
    summary: { total: 1, passed: 0, failed: 1, errors: 0, durationMs: 2 },
    allPassed: false,
    hasFailures: true,
    hasErrors: false,
    results: [
      {
        assertionId: "1",
        type: "statusCode",
        outcome: "failed",
        message: "Status code was 200, expected 201",
      },
    ],
  };

  const classified = classifyApiResult(
    rawResult,
    { expectedStatusCodes: [200] },
    failedAssertionEval,
  );

  assert.equal(classified.status, HEALTH_STATUS.DOWN);
  assert.equal(classified.failureReason, FAILURE_REASONS.ASSERTION_FAILURE);
  assert.match(
    classified.diagnostics.safeFailureReason,
    /Status code was 200, expected 201/,
  );
});

test("Classification Contract: assertion errors classify as down with assertion_error", () => {
  const rawResult = {
    transportCompleted: true,
    httpStatus: 200,
    responseTime: 150,
    headers: {},
  };

  const errorAssertionEval = {
    summary: { total: 1, passed: 0, failed: 0, errors: 1, durationMs: 2 },
    allPassed: false,
    hasFailures: false,
    hasErrors: true,
    results: [
      {
        assertionId: "1",
        type: "jsonPath",
        outcome: "error",
        message: "Response body is not valid JSON",
      },
    ],
  };

  const classified = classifyApiResult(
    rawResult,
    { expectedStatusCodes: [200] },
    errorAssertionEval,
  );

  assert.equal(classified.status, HEALTH_STATUS.DOWN);
  assert.equal(classified.failureReason, FAILURE_REASONS.ASSERTION_ERROR);
  assert.match(classified.diagnostics.safeFailureReason, /not valid JSON/);
});

test("Classification Contract: passing assertions do NOT override unaccepted expectedStatusCodes", () => {
  const rawResult = {
    transportCompleted: true,
    httpStatus: 404,
    responseTime: 150,
    headers: {},
  };

  // Even if a custom assertion passed
  const passingAssertionEval = {
    summary: { total: 1, passed: 1, failed: 0, errors: 0, durationMs: 1 },
    allPassed: true,
    hasFailures: false,
    hasErrors: false,
    results: [
      {
        assertionId: "1",
        type: "responseTime",
        outcome: "passed",
        passed: true,
      },
    ],
  };

  const classified = classifyApiResult(
    rawResult,
    { expectedStatusCodes: [200] },
    passingAssertionEval,
  );

  assert.equal(classified.status, HEALTH_STATUS.DOWN);
  assert.equal(classified.failureReason, FAILURE_REASONS.HTTP_ERROR);
  assert.match(
    classified.diagnostics.safeFailureReason,
    /Received HTTP 404, expected \[200\]/,
  );
});

test("Classification Contract: transport failure takes precedence and skips assertions", () => {
  const rawResult = {
    transportCompleted: false,
    httpStatus: null,
    responseTime: 10000,
    failureReason: FAILURE_REASONS.TIMEOUT,
    safeFailureReason: "Request timed out",
  };

  const classified = classifyApiResult(
    rawResult,
    { expectedStatusCodes: [200] },
    null,
  );

  assert.equal(classified.status, HEALTH_STATUS.DOWN);
  assert.equal(classified.failureReason, FAILURE_REASONS.TIMEOUT);
});

test("Persistence Isolation: HealthCheck document preserves assertionResults and summary without response body", () => {
  const dummyMonitorId = new mongoose.Types.ObjectId();
  const assertionResults = [
    {
      assertionId: "a-1",
      type: "statusCode",
      comparison: "equals",
      targetValue: 200,
      actualValue: 200,
      passed: true,
      outcome: "passed",
      message: null,
      durationMs: 0.5,
    },
    {
      assertionId: "a-2",
      type: "bodyText",
      comparison: "contains",
      targetValue: "expected",
      actualValue: "this is expected response",
      passed: true,
      outcome: "passed",
      message: null,
      durationMs: 0.2,
    },
  ];

  const assertionSummary = {
    total: 2,
    passed: 2,
    failed: 0,
    errors: 0,
    durationMs: 0.7,
  };

  const doc = new HealthCheck({
    monitor: dummyMonitorId,
    status: HEALTH_STATUS.UP,
    frontendStatus: HEALTH_STATUS.UNKNOWN,
    backendStatus: HEALTH_STATUS.UNKNOWN,
    databaseStatus: HEALTH_STATUS.UNKNOWN,
    responseTime: 120,
    httpStatus: 200,
    assertionResults,
    assertionSummary,
    checkedAt: new Date(),
  });

  const plain = doc.toJSON();
  assert.equal(plain.status, "up");
  assert.equal(plain.assertionResults.length, 2);
  assert.equal(plain.assertionSummary.passed, 2);
  assert.equal(plain.rawResponse, undefined);
  assert.equal(plain.body, undefined);
});
