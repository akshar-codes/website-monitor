import test from "node:test";
import assert from "node:assert/strict";
import { classify } from "../src/workers/classifier.js";
import { isPublicAddress, poll } from "../src/workers/poller.js";
import { FAILURE_REASONS, HEALTH_STATUS } from "../src/config/constants.js";
import dns from "node:dns/promises";

const healthyBody = {
  status: "ok",
  services: { frontend: "up", backend: "healthy", database: "operational" },
};

test("classifies a supported all-healthy response", () => {
  const result = classify({ ok: true, httpStatus: 200, body: healthyBody });
  assert.equal(result.status, HEALTH_STATUS.UP);
  assert.equal(result.frontendStatus, HEALTH_STATUS.UP);
  assert.equal(result.backendStatus, HEALTH_STATUS.UP);
  assert.equal(result.databaseStatus, HEALTH_STATUS.UP);
  assert.equal(result.failureReason, null);
});

test("classifies a failed component as down and a degraded component as degraded", () => {
  assert.equal(classify({ ok: true, httpStatus: 200, body: { ...healthyBody, services: { ...healthyBody.services, backend: "down" } } }).status, HEALTH_STATUS.DOWN);
  assert.equal(classify({ ok: true, httpStatus: 200, body: { ...healthyBody, services: { ...healthyBody.services, database: "slow" } } }).status, HEALTH_STATUS.DEGRADED);
});

test("classifies network failures, non-success HTTP responses, malformed JSON, and unexpected contracts", () => {
  assert.equal(classify({ ok: false, httpStatus: null, failureReason: FAILURE_REASONS.TIMEOUT }).status, HEALTH_STATUS.DOWN);
  assert.equal(classify({ ok: false, httpStatus: 503, failureReason: FAILURE_REASONS.HTTP_ERROR }).status, HEALTH_STATUS.DOWN);
  assert.equal(classify({ ok: true, httpStatus: 200, body: null }).failureReason, FAILURE_REASONS.INVALID_JSON);
  assert.equal(classify({ ok: true, httpStatus: 200, body: { status: "ok" } }).failureReason, FAILURE_REASONS.INVALID_CONTRACT);
});

test("public-address policy blocks local, private, link-local, metadata, and reserved ranges", () => {
  for (const address of ["127.0.0.1", "10.0.0.1", "172.20.0.1", "192.168.1.1", "169.254.169.254", "100.100.100.200", "::1", "fc00::1", "fe80::1", "::ffff:127.0.0.1"]) {
    assert.equal(isPublicAddress(address), false, `${address} should be blocked`);
  }
  assert.equal(isPublicAddress("8.8.8.8"), true);
  assert.equal(isPublicAddress("2606:4700:4700::1111"), true);
});

test("poll rejects loopback destinations before making a request", async () => {
  const result = await poll("http://127.0.0.1/health", { maxRetries: 0 });
  assert.equal(result.ok, false);
  assert.equal(result.failureReason, FAILURE_REASONS.UNSAFE_DESTINATION);
  assert.equal(result.body, null);
});

test("poll enforces a total timeout while DNS resolution is pending", async () => {
  const originalLookup = dns.lookup;
  dns.lookup = () => new Promise(() => {});
  try {
    const result = await poll("http://health-check-timeout.example/", { timeout: 10, maxRetries: 0 });
    assert.equal(result.ok, false);
    assert.equal(result.failureReason, FAILURE_REASONS.TIMEOUT);
  } finally {
    dns.lookup = originalLookup;
  }
});
