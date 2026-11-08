import dns from "node:dns/promises";
import { isIP } from "node:net";
import http from "node:http";
import https from "node:https";
import { performance } from "node:perf_hooks";
import { FAILURE_REASONS } from "../config/constants.js";
import {
  cleanHostname,
  isPublicAddress,
  resolvePublicAddresses,
  withTimeout,
} from "../utils/networkSecurity.js";

export { isPublicAddress };

const REDIRECTS = new Set([301, 302, 303, 307, 308]);
const pollerConfig = {
  HEALTH_CHECK_MAX_RESPONSE_BYTES:
    Number(process.env.HEALTH_CHECK_MAX_RESPONSE_BYTES) || 1_048_576,
  POLL_TIMEOUT_MS: Number(process.env.POLL_TIMEOUT_MS) || 10_000,
  POLL_TOTAL_TIMEOUT_MS: Number(process.env.POLL_TOTAL_TIMEOUT_MS) || 30_000,
  MONITOR_RETRY_COUNT: Number(process.env.MONITOR_RETRY_COUNT) || 2,
  MONITOR_RETRY_DELAY: Number(process.env.MONITOR_RETRY_DELAY) || 1_000,
};
const MAX_REDIRECTS = 5;
const SAFE_RESPONSE_HEADERS = [
  "content-type",
  "content-length",
  "cache-control",
];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const requestOnce = (url, addresses, timeoutMs, requestOptions = {}) =>
  new Promise((resolve, reject) => {
    const transport = url.protocol === "https:" ? https : http;
    let settled = false;
    const requestStarted = performance.now();
    const timing = {
      tcpConnectMs: null,
      tlsHandshakeMs: null,
      ttfbMs: null,
      downloadMs: null,
    };
    let tlsStartedAt = null;
    let bodyStartedAt = null;
    const done = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(totalTimer);
      if (fn === reject) {
        if (tlsStartedAt != null && timing.tlsHandshakeMs == null)
          timing.tlsHandshakeMs = performance.now() - tlsStartedAt;
        if (bodyStartedAt != null && timing.downloadMs == null)
          timing.downloadMs = performance.now() - bodyStartedAt;
        value.timings = timing;
      }
      fn(value);
    };
    let addressIndex = 0;
    const lookup = (_hostname, options, callback) => {
      if (options?.all) callback(null, addresses);
      else {
        const selected = addresses[addressIndex++ % addresses.length];
        callback(null, selected.address, selected.family);
      }
    };
    const request = transport.request(
      url,
      {
        method: "GET",
        agent: false,
        lookup,
        headers: {
          "User-Agent": "WebsiteMonitor/1.0",
          Accept: "application/json",
          "Accept-Encoding": "identity",
        },
        ...requestOptions,
      },
      (response) => {
        timing.ttfbMs = performance.now() - requestStarted;
        bodyStartedAt = performance.now();
        const chunks = [];
        let size = 0;
        response.on("data", (chunk) => {
          size += chunk.length;
          if (size > pollerConfig.HEALTH_CHECK_MAX_RESPONSE_BYTES) {
            request.destroy(
              Object.assign(new Error("Response exceeds allowed size"), {
                code: "ERR_RESPONSE_TOO_LARGE",
              }),
            );
            return;
          }
          chunks.push(chunk);
        });
        response.on("end", () =>
          done(resolve, {
            status: response.statusCode,
            headers: Object.fromEntries(
              SAFE_RESPONSE_HEADERS.filter(
                (name) => response.headers[name] != null,
              ).map((name) => [name, response.headers[name]]),
            ),
            body: Buffer.concat(chunks).toString("utf8"),
            location: response.headers.location,
            timing: {
              ...timing,
              downloadMs: performance.now() - bodyStartedAt,
              totalMs: performance.now() - requestStarted,
            },
          }),
        );
        response.on("error", (error) => done(reject, error));
      },
    );
    request.on("socket", (socket) => {
      const socketStarted = performance.now();
      const connected = () => {
        timing.tcpConnectMs = performance.now() - socketStarted;
        if (url.protocol === "https:") {
          tlsStartedAt = performance.now();
          socket.once("secureConnect", () => {
            timing.tlsHandshakeMs = performance.now() - tlsStartedAt;
          });
        }
      };
      if (socket.connecting) socket.once("connect", connected);
      else connected();
    });
    const totalTimer = setTimeout(() => {
      const error = Object.assign(new Error("Request timed out"), {
        code: "ETIMEDOUT",
      });
      request.destroy(error);
      done(reject, error);
    }, timeoutMs);
    request.setTimeout(timeoutMs, () =>
      request.destroy(
        Object.assign(new Error("Connection timed out"), { code: "ETIMEDOUT" }),
      ),
    );
    request.on("error", (error) => done(reject, error));
    request.end();
  });

const singlePoll = async (inputUrl, timeoutMs) => {
  const startedAt = performance.now();
  let currentUrl;
  const timings = {
    dnsMs: 0,
    tcpConnectMs: 0,
    tlsHandshakeMs: 0,
    ttfbMs: 0,
    downloadMs: 0,
    totalMs: 0,
  };
  const available = new Set();
  const redirects = [];
  try {
    currentUrl = new URL(inputUrl);
    if (
      !["http:", "https:"].includes(currentUrl.protocol) ||
      currentUrl.username ||
      currentUrl.password
    ) {
      throw Object.assign(new Error("Unsupported monitor destination"), {
        code: "ERR_BLOCKED_ADDRESS",
      });
    }
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const dnsStartedAt = performance.now();
      const remainingMs = timeoutMs - (performance.now() - startedAt);
      if (remainingMs <= 0)
        throw Object.assign(new Error("Request timed out"), {
          code: "ETIMEDOUT",
        });
      let addresses;
      try {
        addresses = await withTimeout(
          resolvePublicAddresses(currentUrl.hostname),
          remainingMs,
        );
      } finally {
        timings.dnsMs += performance.now() - dnsStartedAt;
      }
      const requestBudgetMs = timeoutMs - (performance.now() - startedAt);
      if (requestBudgetMs <= 0)
        throw Object.assign(new Error("Request timed out"), {
          code: "ETIMEDOUT",
        });
      const response = await requestOnce(
        currentUrl,
        addresses,
        requestBudgetMs,
      );
      for (const key of [
        "tcpConnectMs",
        "tlsHandshakeMs",
        "ttfbMs",
        "downloadMs",
      ]) {
        if (response.timing[key] != null) {
          timings[key] += response.timing[key];
          available.add(key);
        }
      }
      if (REDIRECTS.has(response.status) && response.location) {
        if (hop === MAX_REDIRECTS)
          throw Object.assign(new Error("Too many redirects"), {
            code: "ERR_TOO_MANY_REDIRECTS",
          });
        const nextUrl = new URL(response.location, currentUrl);
        if (
          !["http:", "https:"].includes(nextUrl.protocol) ||
          nextUrl.username ||
          nextUrl.password
        ) {
          throw Object.assign(new Error("Unsupported redirect destination"), {
            code: "ERR_BLOCKED_ADDRESS",
          });
        }
        redirects.push({
          status: response.status,
          destinationHost: cleanHostname(nextUrl.hostname),
        });
        currentUrl = nextUrl;
        continue;
      }
      const responseTime = performance.now() - startedAt;
      timings.totalMs = responseTime;
      const serializedTimings = Object.fromEntries(
        Object.entries(timings).map(([key, value]) => [
          key,
          key === "totalMs" ||
          (key === "dnsMs" && timings.dnsMs > 0) ||
          available.has(key)
            ? Number(value.toFixed(2))
            : null,
        ]),
      );
      let body = null;
      let failureReason = null;
      try {
        body = JSON.parse(response.body);
      } catch {
        failureReason = FAILURE_REASONS.INVALID_JSON;
      }
      const ok = response.status >= 200 && response.status < 300;
      if (!ok) failureReason = FAILURE_REASONS.HTTP_ERROR;
      return {
        ok,
        httpStatus: response.status,
        responseTime,
        body,
        error: null,
        failureReason,
        diagnostics: {
          finalHost: cleanHostname(currentUrl.hostname),
          statusText: null,
          headers: response.headers,
          redirects,
          dns: { durationMs: timings.dnsMs },
          timing: serializedTimings,
        },
        timings: serializedTimings,
      };
    }
    throw Object.assign(new Error("Too many redirects"), {
      code: "ERR_TOO_MANY_REDIRECTS",
    });
  } catch (error) {
    for (const key of [
      "tcpConnectMs",
      "tlsHandshakeMs",
      "ttfbMs",
      "downloadMs",
    ]) {
      if (error.timings?.[key] != null) {
        timings[key] += error.timings[key];
        available.add(key);
      }
    }
    const responseTime = performance.now() - startedAt;
    timings.totalMs = responseTime;
    const serializedTimings = Object.fromEntries(
      Object.entries(timings).map(([key, value]) => [
        key,
        key === "totalMs" ||
        (key === "dnsMs" && timings.dnsMs > 0) ||
        available.has(key)
          ? Number(value.toFixed(2))
          : null,
      ]),
    );
    const errorCode = error.code || error.cause?.code || "UNKNOWN";
    const failureReason =
      errorCode === "ENOTFOUND" || errorCode === "EAI_AGAIN"
        ? FAILURE_REASONS.DNS_ERROR
        : errorCode === "ETIMEDOUT"
          ? FAILURE_REASONS.TIMEOUT
          : errorCode === "ECONNREFUSED"
            ? FAILURE_REASONS.CONNECTION_REFUSED
            : errorCode === "ERR_BLOCKED_ADDRESS" ||
                errorCode === "ERR_TOO_MANY_REDIRECTS"
              ? FAILURE_REASONS.UNSAFE_DESTINATION
              : errorCode === "ERR_RESPONSE_TOO_LARGE"
                ? FAILURE_REASONS.RESPONSE_TOO_LARGE
                : FAILURE_REASONS.UNKNOWN;
    return {
      ok: false,
      httpStatus: null,
      responseTime,
      body: null,
      error: failureReason,
      failureReason,
      diagnostics: {
        finalHost: currentUrl ? cleanHostname(currentUrl.hostname) : null,
        headers: {},
        redirects,
        dns: { durationMs: timings.dnsMs },
        timing: serializedTimings,
        errorCode:
          errorCode === "ERR_BLOCKED_ADDRESS"
            ? "blocked_destination"
            : errorCode,
      },
      timings: serializedTimings,
    };
  }
};

export const poll = async (url, opts = {}) => {
  const timeout = opts.timeout ?? pollerConfig.POLL_TIMEOUT_MS;
  const totalTimeout = opts.totalTimeout ?? pollerConfig.POLL_TOTAL_TIMEOUT_MS;
  const maxRetries = opts.maxRetries ?? pollerConfig.MONITOR_RETRY_COUNT;
  const retryDelay = opts.retryDelay ?? pollerConfig.MONITOR_RETRY_DELAY;
  const deadline = Date.now() + totalTimeout;
  let result;
  for (let attempt = 0; attempt <= Math.min(5, maxRetries); attempt++) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    if (attempt > 0) {
      const delay = Math.min(
        30_000,
        retryDelay * 2 ** (attempt - 1),
        remaining,
      );
      console.debug("Retrying monitor request", {
        attempt,
        maxRetries,
        delayMs: delay,
      });
      await sleep(delay);
    }
    const attemptBudget = Math.min(timeout, deadline - Date.now());
    if (attemptBudget <= 0) break;
    result = await singlePoll(url, attemptBudget);
    if (
      result.ok ||
      result.failureReason === FAILURE_REASONS.UNSAFE_DESTINATION
    )
      return result;
  }
  if (!result) {
    result = {
      ok: false,
      httpStatus: null,
      responseTime: totalTimeout,
      body: null,
      error: FAILURE_REASONS.TIMEOUT,
      failureReason: FAILURE_REASONS.TIMEOUT,
      timings: {
        dnsMs: null,
        tcpConnectMs: null,
        tlsHandshakeMs: null,
        ttfbMs: null,
        downloadMs: null,
        totalMs: totalTimeout,
      },
      diagnostics: {
        timing: { totalMs: totalTimeout },
        errorCode: "ETIMEDOUT",
      },
    };
  }
  return result;
};
