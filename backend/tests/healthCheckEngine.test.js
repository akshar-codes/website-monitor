import test from "node:test";
import assert from "node:assert/strict";
import { classify } from "../src/workers/classifier.js";
import { isPublicAddress, poll, requestOnce } from "../src/workers/poller.js";
import { FAILURE_REASONS, HEALTH_STATUS } from "../src/config/constants.js";
import dns from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { readFileSync } from "node:fs";

const healthyBody = {
  status: "ok",
  services: { frontend: "up", backend: "healthy", database: "operational" },
};

const TLS_TEST_CERT = readFileSync(
  new URL("./fixtures/performance-test-cert.pem", import.meta.url),
  "utf8",
);
const TLS_TEST_KEY = readFileSync(
  new URL("./fixtures/performance-test-key.pem", import.meta.url),
  "utf8",
);

test("classifies a supported all-healthy response", () => {
  const result = classify({ ok: true, httpStatus: 200, body: healthyBody });
  assert.equal(result.status, HEALTH_STATUS.UP);
  assert.equal(result.frontendStatus, HEALTH_STATUS.UP);
  assert.equal(result.backendStatus, HEALTH_STATUS.UP);
  assert.equal(result.databaseStatus, HEALTH_STATUS.UP);
  assert.equal(result.failureReason, null);
});

test("classifies a failed component as down and a degraded component as degraded", () => {
  assert.equal(
    classify({
      ok: true,
      httpStatus: 200,
      body: {
        ...healthyBody,
        services: { ...healthyBody.services, backend: "down" },
      },
    }).status,
    HEALTH_STATUS.DOWN,
  );
  assert.equal(
    classify({
      ok: true,
      httpStatus: 200,
      body: {
        ...healthyBody,
        services: { ...healthyBody.services, database: "slow" },
      },
    }).status,
    HEALTH_STATUS.DEGRADED,
  );
});

test("classifies network failures, non-success HTTP responses, malformed JSON, and unexpected contracts", () => {
  assert.equal(
    classify({
      ok: false,
      httpStatus: null,
      failureReason: FAILURE_REASONS.TIMEOUT,
    }).status,
    HEALTH_STATUS.DOWN,
  );
  assert.equal(
    classify({
      ok: false,
      httpStatus: 503,
      failureReason: FAILURE_REASONS.HTTP_ERROR,
    }).status,
    HEALTH_STATUS.DOWN,
  );
  assert.equal(
    classify({ ok: true, httpStatus: 200, body: null }).failureReason,
    FAILURE_REASONS.INVALID_JSON,
  );
  assert.equal(
    classify({ ok: true, httpStatus: 200, body: { status: "ok" } })
      .failureReason,
    FAILURE_REASONS.INVALID_CONTRACT,
  );
});

test("public-address policy blocks local, private, link-local, metadata, and reserved ranges", () => {
  for (const address of [
    "127.0.0.1",
    "10.0.0.1",
    "172.20.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "100.100.100.200",
    "::1",
    "fc00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
  ]) {
    assert.equal(
      isPublicAddress(address),
      false,
      `${address} should be blocked`,
    );
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

test("HTTP request timings capture connect, TTFB, download, and partial timeout data", async (t) => {
  const server = http.createServer((req, res) => {
    setTimeout(
      () => {
        res.writeHead(200, { "content-type": "text/plain" });
        res.end("timed response");
      },
      req.url === "/slow" ? 100 : 25,
    );
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const address = server.address();
  const url = new URL(`http://timing-test.invalid:${address.port}/fast`);
  const result = await requestOnce(
    url,
    [{ address: "127.0.0.1", family: 4 }],
    500,
  );
  assert.equal(result.status, 200);
  assert.ok(result.timing.tcpConnectMs >= 0);
  assert.ok(result.timing.ttfbMs >= 15);
  assert.ok(result.timing.downloadMs >= 0);
  assert.equal(result.timing.tlsHandshakeMs, null);
  await assert.rejects(
    requestOnce(
      new URL(`http://timing-test.invalid:${address.port}/slow`),
      [{ address: "127.0.0.1", family: 4 }],
      30,
    ),
    (error) => {
      assert.ok(error.timings.tcpConnectMs >= 0);
      assert.equal(error.timings.ttfbMs, null);
      return error.code === "ETIMEDOUT";
    },
  );
});

test("HTTPS timings measure a real TLS handshake and preserve failed-handshake timing", async (t) => {
  const server = https.createServer(
    { key: TLS_TEST_KEY, cert: TLS_TEST_CERT },
    (_req, res) => res.end("secure response"),
  );
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const url = new URL(`https://localhost:${server.address().port}/`);
  const result = await requestOnce(
    url,
    [{ address: "127.0.0.1", family: 4 }],
    1_000,
    { rejectUnauthorized: false },
  );
  assert.equal(result.status, 200);
  assert.ok(result.timing.tcpConnectMs >= 0);
  assert.ok(result.timing.tlsHandshakeMs >= 0);
  assert.ok(result.timing.ttfbMs >= 0);

  const plainServer = http.createServer((_req, res) => res.end("not TLS"));
  await new Promise((resolve) => plainServer.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => plainServer.close(resolve)));
  await assert.rejects(
    requestOnce(
      new URL(`https://localhost:${plainServer.address().port}/`),
      [{ address: "127.0.0.1", family: 4 }],
      1_000,
      { rejectUnauthorized: false },
    ),
    (error) => {
      assert.ok(error.timings.tcpConnectMs >= 0);
      assert.ok(error.timings.tlsHandshakeMs >= 0);
      assert.equal(error.timings.ttfbMs, null);
      return true;
    },
  );
});

test("poll enforces a total timeout while DNS resolution is pending", async () => {
  const originalLookup = dns.lookup;
  dns.lookup = () => new Promise(() => {});
  try {
    const result = await poll("http://health-check-timeout.example/", {
      timeout: 10,
      maxRetries: 0,
    });
    assert.equal(result.ok, false);
    assert.equal(result.failureReason, FAILURE_REASONS.TIMEOUT);
  } finally {
    dns.lookup = originalLookup;
  }
});

test("poll retry count and exponential backoff stay within the total request budget", async () => {
  const originalLookup = dns.lookup;
  dns.lookup = () => new Promise(() => {});
  const started = Date.now();
  try {
    const result = await poll("http://slow-dns.example/health", {
      timeout: 50,
      totalTimeout: 25,
      maxRetries: 99,
      retryDelay: 10,
    });
    assert.equal(result.failureReason, FAILURE_REASONS.TIMEOUT);
    assert.ok(
      Date.now() - started < 500,
      "poll must not exceed its total budget materially",
    );
  } finally {
    dns.lookup = originalLookup;
  }
});
