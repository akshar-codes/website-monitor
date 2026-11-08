import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { isPublicAddress, poll, requestOnce } from "../src/workers/poller.js";
import { classify } from "../src/workers/classifier.js";
import { FAILURE_REASONS, HEALTH_STATUS } from "../src/config/constants.js";

const validContractBody = {
  status: "ok",
  services: {
    frontend: "operational",
    backend: "healthy",
    database: "running",
  },
};

test("Website Classifier: maps valid contract to UP", () => {
  const result = classify({
    ok: true,
    httpStatus: 200,
    body: validContractBody,
    failureReason: null,
  });
  assert.equal(result.status, HEALTH_STATUS.UP);
  assert.equal(result.frontendStatus, HEALTH_STATUS.UP);
  assert.equal(result.backendStatus, HEALTH_STATUS.UP);
  assert.equal(result.databaseStatus, HEALTH_STATUS.UP);
  assert.equal(result.failureReason, null);
});

test("Website Classifier: non-200 HTTP status classifies as DOWN with http_error", () => {
  const result = classify({
    ok: false,
    httpStatus: 500,
    body: null,
    failureReason: FAILURE_REASONS.HTTP_ERROR,
  });
  assert.equal(result.status, HEALTH_STATUS.DOWN);
  assert.equal(result.failureReason, FAILURE_REASONS.HTTP_ERROR);
});

test("Website Classifier: degraded components and invalid contracts classify as DEGRADED", () => {
  const degradedResult = classify({
    ok: true,
    httpStatus: 200,
    body: {
      status: "ok",
      services: { frontend: "up", backend: "degraded", database: "up" },
    },
  });
  assert.equal(degradedResult.status, HEALTH_STATUS.DEGRADED);

  const invalidJsonResult = classify({
    ok: true,
    httpStatus: 200,
    body: null,
    failureReason: FAILURE_REASONS.INVALID_JSON,
  });
  assert.equal(invalidJsonResult.status, HEALTH_STATUS.DEGRADED);
  assert.equal(invalidJsonResult.failureReason, FAILURE_REASONS.INVALID_JSON);

  const invalidContractResult = classify({
    ok: true,
    httpStatus: 200,
    body: { status: "ok" },
  });
  assert.equal(invalidContractResult.status, HEALTH_STATUS.DEGRADED);
  assert.equal(
    invalidContractResult.failureReason,
    FAILURE_REASONS.INVALID_CONTRACT,
  );
});

test("Website Poller: requestOnce executes GET and parses response headers and timings", async (t) => {
  const server = http.createServer((_req, res) => {
    res.writeHead(200, {
      "content-type": "application/json",
      "cache-control": "no-cache",
    });
    res.end(JSON.stringify(validContractBody));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const port = server.address().port;
  const url = new URL(`http://test-host.invalid:${port}/health`);
  const response = await requestOnce(
    url,
    [{ address: "127.0.0.1", family: 4 }],
    2000,
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers["content-type"], "application/json");
  assert.equal(response.headers["cache-control"], "no-cache");
  assert.ok(response.timing.tcpConnectMs >= 0);
  assert.ok(response.timing.ttfbMs >= 0);
  assert.ok(response.timing.downloadMs >= 0);
  assert.ok(response.timing.totalMs >= 0);
});

test("Website Poller: follows up to 5 redirects for GET requests", async (t) => {
  let hops = 0;
  const server = http.createServer((req, res) => {
    const current = Number(req.url.replace("/", "")) || 0;
    hops++;
    if (current < 3) {
      res.writeHead(302, { location: `/${current + 1}` });
      res.end();
    } else {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(validContractBody));
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const port = server.address().port;
  const url = new URL(`http://redirect-test.invalid:${port}/0`);
  const response = await requestOnce(
    url,
    [{ address: "127.0.0.1", family: 4 }],
    2000,
  );
  assert.equal(response.status, 302);
  assert.equal(response.location, "/1");
});

test("Website Poller: response size exceeding limit triggers ERR_RESPONSE_TOO_LARGE", async (t) => {
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { "content-type": "text/plain" });
    // Write 2 MB chunk
    const chunk = Buffer.alloc(1024 * 1024, "a");
    res.write(chunk);
    res.write(chunk);
    res.end();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const port = server.address().port;
  const url = new URL(`http://oversized-test.invalid:${port}/big`);
  await assert.rejects(
    requestOnce(url, [{ address: "127.0.0.1", family: 4 }], 2000),
    (error) => error.code === "ERR_RESPONSE_TOO_LARGE",
  );
});

test("Website Poller: rejects private and loopback destinations before sending request", async () => {
  for (const target of [
    "http://127.0.0.1:8080/health",
    "http://10.0.0.1/status",
    "http://192.168.1.1/api",
    "http://169.254.169.254/latest/meta-data",
  ]) {
    const result = await poll(target, { maxRetries: 0 });
    assert.equal(result.ok, false);
    assert.equal(result.failureReason, FAILURE_REASONS.UNSAFE_DESTINATION);
    assert.equal(result.diagnostics.errorCode, "blocked_destination");
  }
});
