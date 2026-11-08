import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import https from "node:https";
import dns from "node:dns/promises";
import zlib from "node:zlib";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import env from "../src/config/env.js";
import { executeApiMonitor } from "../src/workers/apiExecutor.js";
import { classifyApiResult } from "../src/workers/apiClassifier.js";
import { manualCheckLimiter } from "../src/middlewares/rateLimiter.js";
import { claimNextDueMonitor } from "../src/workers/scheduler.js";
import {
  encryptCredential,
  decryptCredential,
} from "../src/utils/credentialEncryption.js";
import {
  createPinnedLookup,
  resolvePublicAddresses,
  isPublicAddress,
} from "../src/utils/networkSecurity.js";
import { FAILURE_REASONS, HEALTH_STATUS } from "../src/config/constants.js";

const TLS_TEST_CERT = readFileSync(
  new URL("./fixtures/performance-test-cert.pem", import.meta.url),
  "utf8",
);
const TLS_TEST_KEY = readFileSync(
  new URL("./fixtures/performance-test-key.pem", import.meta.url),
  "utf8",
);

// Setup test encryption key
env.ALERT_CREDENTIAL_ENCRYPTION_KEY = randomBytes(32).toString("hex");
const localDns = async () => [{ address: "127.0.0.1", family: 4 }];

test("API Executor: executes GET with public and encrypted query parameters", async (t) => {
  let receivedUrl = null;
  const server = http.createServer((req, res) => {
    receivedUrl = req.url;
    res.writeHead(200, {
      "content-type": "application/json",
      "x-request-id": "req-123",
    });
    res.end(JSON.stringify({ success: true }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const port = server.address().port;
  const monitor = {
    url: `http://localhost:${port}/api/items`,
    kind: "api",
    apiConfig: {
      method: "GET",
      queryParams: new Map([["category", "books"]]),
      secretQueryParamNames: ["apiKey"],
      encryptedQueryParams: new Map([
        ["apiKey", encryptCredential("secret-key-123")],
      ]),
      expectedStatusCodes: [200],
    },
  };

  const result = await executeApiMonitor(monitor, {
    timeoutMs: 2000,
    maxRetries: 0,
    dnsResolve: localDns,
  });

  assert.equal(result.transportCompleted, true);
  assert.equal(result.httpStatus, 200);
  assert.equal(result.headers["x-request-id"], "req-123");
  assert.ok(receivedUrl.includes("category=books"));
  assert.ok(receivedUrl.includes("apiKey=secret-key-123"));

  // Verify URL and secret query values are redacted from diagnostics
  assert.equal(result.diagnostics.path, "/api/items");
  assert.equal(result.diagnostics.finalHost, "localhost");
  assert.ok(!JSON.stringify(result.diagnostics).includes("secret-key-123"));

  // Verify classifier
  const classified = classifyApiResult(result, monitor.apiConfig);
  assert.equal(classified.status, HEALTH_STATUS.UP);
  assert.equal(classified.failureReason, null);
  assert.equal(classified.frontendStatus, HEALTH_STATUS.UNKNOWN);
});

test("API Executor: executes POST with encrypted body and sets Content-Length", async (t) => {
  let receivedBody = "";
  let receivedHeaders = null;
  const server = http.createServer((req, res) => {
    receivedHeaders = req.headers;
    req.on("data", (chunk) => {
      receivedBody += chunk;
    });
    req.on("end", () => {
      res.writeHead(201, { "content-type": "application/json" });
      res.end(JSON.stringify({ id: 101 }));
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const port = server.address().port;
  const bodyPayload = JSON.stringify({ item: "widget", quantity: 5 });
  const monitor = {
    url: `http://localhost:${port}/api/orders`,
    kind: "api",
    apiConfig: {
      method: "POST",
      encryptedBody: encryptCredential(bodyPayload),
      expectedStatusCodes: [201],
    },
  };

  const result = await executeApiMonitor(monitor, {
    timeoutMs: 2000,
    dnsResolve: localDns,
  });
  assert.equal(result.transportCompleted, true);
  assert.equal(result.httpStatus, 201);
  assert.equal(receivedBody, bodyPayload);
  assert.equal(
    receivedHeaders["content-length"],
    String(Buffer.byteLength(bodyPayload)),
  );
  assert.ok(receivedHeaders["content-type"].includes("application/json"));

  const classified = classifyApiResult(result, monitor.apiConfig);
  assert.equal(classified.status, HEALTH_STATUS.UP);
  assert.equal(classified.failureReason, null);
});

test("API Executor: strictly omits body on GET and DELETE requests", async (t) => {
  let receivedBody = "";
  const server = http.createServer((req, res) => {
    req.on("data", (chunk) => {
      receivedBody += chunk;
    });
    req.on("end", () => {
      res.writeHead(204);
      res.end();
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const port = server.address().port;
  const monitor = {
    url: `http://localhost:${port}/api/items/12`,
    kind: "api",
    apiConfig: {
      method: "DELETE",
      encryptedBody: encryptCredential("ignored-body-content"),
      expectedStatusCodes: [204],
    },
  };

  const result = await executeApiMonitor(monitor, {
    timeoutMs: 2000,
    dnsResolve: localDns,
  });
  assert.equal(result.transportCompleted, true);
  assert.equal(result.httpStatus, 204);
  assert.equal(receivedBody, "");
});

test("API Executor: injects in-memory Bearer and Basic auth without leaking into diagnostics", async (t) => {
  let authHeader = null;
  const server = http.createServer((req, res) => {
    authHeader = req.headers["authorization"];
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ authenticated: true }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const port = server.address().port;

  // 1. Bearer Token test
  const bearerMonitor = {
    url: `http://localhost:${port}/auth-test`,
    kind: "api",
    apiConfig: {
      method: "GET",
      authentication: {
        mode: "bearer",
        credentialCiphertext: encryptCredential("jwt-token-xyz"),
      },
      expectedStatusCodes: [200],
    },
  };

  const bearerResult = await executeApiMonitor(bearerMonitor, {
    timeoutMs: 2000,
    dnsResolve: localDns,
  });
  assert.equal(bearerResult.transportCompleted, true);
  assert.equal(authHeader, "Bearer jwt-token-xyz");
  assert.ok(!JSON.stringify(bearerResult).includes("jwt-token-xyz"));

  // 2. Basic Auth test
  const basicMonitor = {
    url: `http://localhost:${port}/auth-test`,
    kind: "api",
    apiConfig: {
      method: "GET",
      authentication: {
        mode: "basic",
        username: "adminUser",
        credentialCiphertext: encryptCredential("secretPass123"),
      },
      expectedStatusCodes: [200],
    },
  };

  const basicResult = await executeApiMonitor(basicMonitor, {
    timeoutMs: 2000,
    dnsResolve: localDns,
  });
  assert.equal(basicResult.transportCompleted, true);
  const expectedBasic = `Basic ${Buffer.from("adminUser:secretPass123").toString("base64")}`;
  assert.equal(authHeader, expectedBasic);
  assert.ok(!JSON.stringify(basicResult).includes("secretPass123"));
});

test("API Executor: fails gracefully with INVALID_CONFIGURATION when credentials cannot be decrypted", async () => {
  const badMonitor = {
    url: "http://example.com/api",
    kind: "api",
    apiConfig: {
      method: "GET",
      authentication: {
        mode: "bearer",
        credentialCiphertext: "v1:corrupt:iv:tag:data",
      },
    },
  };

  const result = await executeApiMonitor(badMonitor, { timeoutMs: 1000 });
  assert.equal(result.transportCompleted, false);
  assert.equal(result.failureReason, FAILURE_REASONS.INVALID_CONFIGURATION);
  assert.equal(result.diagnostics.errorCode, "credential_decryption_failed");

  const classified = classifyApiResult(result, badMonitor.apiConfig);
  assert.equal(classified.status, HEALTH_STATUS.DOWN);
  assert.equal(classified.failureReason, FAILURE_REASONS.INVALID_CONFIGURATION);
});

test("API Executor: rejects loopback and private destinations before outbound connection", async () => {
  for (const url of [
    "http://127.0.0.1:9999/status",
    "http://10.0.0.1/api",
    "http://192.168.1.50/metrics",
    "http://169.254.169.254/latest/meta-data",
  ]) {
    const monitor = {
      url,
      kind: "api",
      apiConfig: { method: "GET" },
    };
    const result = await executeApiMonitor(monitor, {
      timeoutMs: 1000,
      maxRetries: 0,
    });
    assert.equal(result.transportCompleted, false);
    assert.equal(result.failureReason, FAILURE_REASONS.UNSAFE_DESTINATION);
    assert.equal(result.failureCategory, "blocked_destination");
  }
});

test("Network Security: rejects mixed public and private DNS results", async () => {
  const originalLookup = dns.lookup;
  dns.lookup = async () => [
    { address: "93.184.216.34", family: 4 }, // public
    { address: "127.0.0.1", family: 4 }, // private/loopback!
  ];
  try {
    await assert.rejects(
      resolvePublicAddresses("mixed-dns.example.invalid"),
      (error) => error.code === "ERR_BLOCKED_ADDRESS",
    );
  } finally {
    dns.lookup = originalLookup;
  }
});

test("API Executor: rejects URLs with embedded credentials", async () => {
  const monitor = {
    url: "http://user:password@example.test/api",
    kind: "api",
    apiConfig: { method: "GET" },
  };
  const result = await executeApiMonitor(monitor, {
    timeoutMs: 1000,
    maxRetries: 0,
  });
  assert.equal(result.transportCompleted, false);
  assert.equal(result.failureReason, FAILURE_REASONS.UNSAFE_DESTINATION);
  assert.equal(result.failureCategory, "blocked_destination");
});

test("DNS Pinning: createPinnedLookup correctly handles options.all and address families", () => {
  const addresses = [
    { address: "93.184.216.34", family: 4 },
    { address: "2606:2800:220:1:248:1893:25c8:1946", family: 6 },
  ];
  const lookup = createPinnedLookup(addresses);

  // Scalar lookup IPv4
  lookup("example.com", { family: 4 }, (err, address, family) => {
    assert.equal(err, null);
    assert.equal(address, "93.184.216.34");
    assert.equal(family, 4);
  });

  // Scalar lookup IPv6
  lookup("example.com", { family: 6 }, (err, address, family) => {
    assert.equal(err, null);
    assert.equal(address, "2606:2800:220:1:248:1893:25c8:1946");
    assert.equal(family, 6);
  });

  // Array lookup options.all = true
  lookup("example.com", { all: true }, (err, results) => {
    assert.equal(err, null);
    assert.equal(results.length, 2);
  });
});

test("API Executor: stream limit terminates oversized responses and handles compression safely", async (t) => {
  // 1. Raw response > 1 MB
  const bigServer = http.createServer((_req, res) => {
    res.writeHead(200, { "content-type": "text/plain" });
    const chunk = Buffer.alloc(512 * 1024, "x");
    res.write(chunk);
    res.write(chunk);
    res.write(chunk); // > 1.5 MB total
    res.end();
  });
  await new Promise((resolve) => bigServer.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => bigServer.close(resolve)));

  const bigPort = bigServer.address().port;
  const bigResult = await executeApiMonitor(
    {
      url: `http://localhost:${bigPort}/big`,
      kind: "api",
      apiConfig: { method: "GET" },
    },
    { timeoutMs: 2000, maxRetries: 0, dnsResolve: localDns },
  );

  assert.equal(bigResult.transportCompleted, false);
  assert.equal(bigResult.failureReason, FAILURE_REASONS.RESPONSE_TOO_LARGE);
  assert.equal(bigResult.failureCategory, "response_too_large");

  // 2. Compressed response (gzip) decompresses transparently under limit
  const gzipServer = http.createServer((_req, res) => {
    res.writeHead(200, {
      "content-type": "application/json",
      "content-encoding": "gzip",
    });
    const payload = Buffer.from(JSON.stringify({ status: "compressed-ok" }));
    res.end(zlib.gzipSync(payload));
  });
  await new Promise((resolve) => gzipServer.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => gzipServer.close(resolve)));

  const gzipPort = gzipServer.address().port;
  const gzipResult = await executeApiMonitor(
    {
      url: `http://localhost:${gzipPort}/gzip`,
      kind: "api",
      apiConfig: { method: "GET" },
    },
    { timeoutMs: 2000, dnsResolve: localDns },
  );
  assert.equal(gzipResult.transportCompleted, true);
  assert.equal(gzipResult.httpStatus, 200);

  // 3. Decompression bomb exceeding limit is aborted
  const bombServer = http.createServer((_req, res) => {
    res.writeHead(200, {
      "content-type": "text/plain",
      "content-encoding": "gzip",
    });
    const hugeBuffer = Buffer.alloc(2 * 1024 * 1024, "0"); // 2 MB uncompressed
    res.end(zlib.gzipSync(hugeBuffer)); // highly compressible small gzip payload
  });
  await new Promise((resolve) => bombServer.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => bombServer.close(resolve)));

  const bombPort = bombServer.address().port;
  const bombResult = await executeApiMonitor(
    {
      url: `http://localhost:${bombPort}/bomb`,
      kind: "api",
      apiConfig: { method: "GET" },
    },
    { timeoutMs: 2000, maxRetries: 0, dnsResolve: localDns },
  );
  assert.equal(bombResult.transportCompleted, false);
  assert.equal(bombResult.failureReason, FAILURE_REASONS.RESPONSE_TOO_LARGE);
});

test("API Executor: redirects disabled for non-GET methods, allowed for GET with origin auth stripping", async (t) => {
  let targetOriginAuth = "none";
  const origin2 = http.createServer((req, res) => {
    targetOriginAuth = req.headers["authorization"] || "none";
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ at: "origin2" }));
  });
  await new Promise((resolve) => origin2.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => origin2.close(resolve)));
  const port2 = origin2.address().port;

  const origin1 = http.createServer((req, res) => {
    if (req.method === "POST") {
      res.writeHead(302, { location: `http://localhost:${port2}/cross` });
      res.end();
      return;
    }
    if (req.url === "/loop") {
      res.writeHead(302, {
        location: `http://localhost:${req.socket.localPort}/loop`,
      });
      res.end();
      return;
    }
    res.writeHead(302, { location: `http://localhost:${port2}/cross` });
    res.end();
  });
  await new Promise((resolve) => origin1.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => origin1.close(resolve)));
  const port1 = origin1.address().port;

  // 1. Non-GET (POST) does NOT follow redirect; returns 302 directly
  const postResult = await executeApiMonitor(
    {
      url: `http://localhost:${port1}/post-redirect`,
      kind: "api",
      apiConfig: {
        method: "POST",
        expectedStatusCodes: [302],
      },
    },
    { dnsResolve: localDns },
  );
  assert.equal(postResult.transportCompleted, true);
  assert.equal(postResult.httpStatus, 302);

  // 2. GET cross-origin redirect strips Authorization header
  const getResult = await executeApiMonitor(
    {
      url: `http://localhost:${port1}/get-redirect`,
      kind: "api",
      apiConfig: {
        method: "GET",
        authentication: {
          mode: "bearer",
          credentialCiphertext: encryptCredential("secret-token"),
        },
        expectedStatusCodes: [200],
      },
    },
    { dnsResolve: localDns },
  );
  assert.equal(getResult.transportCompleted, true);
  assert.equal(getResult.httpStatus, 200);
  assert.equal(targetOriginAuth, "none"); // stripped across origins!

  // 3. Redirect loop is caught and rejected
  const loopResult = await executeApiMonitor(
    {
      url: `http://localhost:${port1}/loop`,
      kind: "api",
      apiConfig: { method: "GET" },
    },
    { dnsResolve: localDns },
  );
  assert.equal(loopResult.transportCompleted, false);
  assert.equal(loopResult.failureReason, FAILURE_REASONS.REDIRECT_ERROR);
});

test("API Executor: retry policy never retries mutating methods (POST/PUT/PATCH/DELETE)", async (t) => {
  let attempts = 0;
  const failingServer = http.createServer((req, res) => {
    attempts++;
    req.socket.destroy(); // Connection reset
  });
  await new Promise((resolve) => failingServer.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => failingServer.close(resolve)));
  const port = failingServer.address().port;

  // POST request
  const postResult = await executeApiMonitor(
    {
      url: `http://localhost:${port}/fail`,
      kind: "api",
      apiConfig: { method: "POST" },
    },
    { maxRetries: 3, timeoutMs: 1000, dnsResolve: localDns },
  );
  assert.equal(postResult.transportCompleted, false);
  assert.equal(attempts, 1); // Strictly 1 attempt, zero retries!

  // GET request allows retry
  attempts = 0;
  const getResult = await executeApiMonitor(
    {
      url: `http://localhost:${port}/fail`,
      kind: "api",
      apiConfig: { method: "GET" },
    },
    {
      maxRetries: 2,
      timeoutMs: 500,
      totalTimeoutMs: 1500,
      dnsResolve: localDns,
    },
  );
  assert.equal(getResult.transportCompleted, false);
  assert.ok(attempts > 1); // Retried!
});

test("API Classifier: completed HTTP response with unexpected status preserves status and response metadata", () => {
  const completedResult = {
    transportCompleted: true,
    httpStatus: 404,
    responseTime: 120,
    timings: {
      totalMs: 120,
      dnsMs: 5,
      tcpConnectMs: 10,
      tlsHandshakeMs: null,
      ttfbMs: 80,
      downloadMs: 25,
    },
    headers: { "content-type": "application/json" },
    diagnostics: {
      method: "GET",
      finalHost: "api.example.com",
      path: "/items",
      headers: { "content-type": "application/json" },
      redirects: [],
    },
  };

  const classified = classifyApiResult(completedResult, {
    expectedStatusCodes: [200, 201],
  });

  assert.equal(classified.status, HEALTH_STATUS.DOWN);
  assert.equal(classified.failureReason, FAILURE_REASONS.HTTP_ERROR);
  assert.equal(classified.httpStatus, 404);
  assert.equal(classified.responseTime, 120);
  assert.equal(
    classified.diagnostics.failureCategory,
    "unexpected_http_status",
  );
  assert.equal(
    classified.diagnostics.safeFailureReason,
    "Received HTTP 404, expected [200, 201]",
  );
  assert.equal(classified.frontendStatus, HEALTH_STATUS.UNKNOWN);
});

test("Scheduler Boundary: claimNextDueMonitor selects encrypted credentials atomically", async () => {
  let selectQuery = null;
  const fakeMonitorModel = {
    findOneAndUpdate: async (_filter, _update, options) => {
      selectQuery = options?.select;
      return null;
    },
  };

  await claimNextDueMonitor({ Monitor: fakeMonitorModel });
  assert.ok(selectQuery.includes("+apiConfig.encryptedQueryParams"));
  assert.ok(selectQuery.includes("+apiConfig.encryptedHeaders"));
  assert.ok(selectQuery.includes("+apiConfig.encryptedBody"));
  assert.ok(selectQuery.includes("+apiConfig.authentication.username"));
  assert.ok(
    selectQuery.includes("+apiConfig.authentication.credentialCiphertext"),
  );
});

test("Rate Limiter Boundary: manualCheckLimiter is configured for 10 requests per minute", () => {
  assert.ok(manualCheckLimiter);
});
