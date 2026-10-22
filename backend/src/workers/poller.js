import dns from "node:dns/promises";
import { isIP } from "node:net";
import http from "node:http";
import https from "node:https";
import env from "../config/env.js";
import logger from "../utils/logger.js";
import { FAILURE_REASONS } from "../config/constants.js";

const REDIRECTS = new Set([301, 302, 303, 307, 308]);
const MAX_REDIRECTS = 5;
const SAFE_RESPONSE_HEADERS = [
  "content-type",
  "content-length",
  "cache-control",
];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const cleanHostname = (hostname) =>
  hostname.replace(/^\[|\]$/g, "").toLowerCase();

const ipv4IsPublic = (address) => {
  const parts = address.split(".").map(Number);
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  )
    return false;
  const [a, b, c] = parts;
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 &&
      (b === 168 || (b === 0 && c === 0) || (b === 0 && c === 2))) ||
    (a === 192 && b === 88 && c === 99) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113) ||
    a === 255
  );
};

const ipv6IsPublic = (address) => {
  const normalized = address.toLowerCase().split("%", 1)[0];
  if (normalized === "::" || normalized === "::1") return false;
  if (normalized.startsWith("::ffff:")) {
    const mapped = normalized.slice(7);
    if (isIP(mapped) === 4) return ipv4IsPublic(mapped);
    const hex = mapped.split(":").join("");
    if (hex.length === 8) {
      const v4 = [0, 2, 4, 6]
        .map((i) => parseInt(hex.slice(i, i + 2), 16))
        .join(".");
      return ipv4IsPublic(v4);
    }
    return false;
  }
  const first = parseInt(normalized.split(":")[0] || "0", 16);
  return !(
    (first & 0xfe00) === 0xfc00 || // unique-local
    (first & 0xffc0) === 0xfe80 || // link-local
    (first & 0xff00) === 0xff00 || // multicast
    (first & 0xe000) !== 0x2000 || // outside global-unicast 2000::/3
    (first === 0x2001 &&
      parseInt(normalized.split(":")[1] || "0", 16) <= 0x01ff) ||
    normalized.startsWith("2001:db8:")
  );
};

export const isPublicAddress = (address) => {
  const family = isIP(address);
  return family === 4
    ? ipv4IsPublic(address)
    : family === 6
      ? ipv6IsPublic(address)
      : false;
};

const resolvePublicAddresses = async (hostname) => {
  const host = cleanHostname(hostname);
  let addresses;
  const family = isIP(host);
  if (family) addresses = [{ address: host, family }];
  else addresses = await dns.lookup(host, { all: true, verbatim: true });
  if (
    !addresses.length ||
    addresses.some(({ address }) => !isPublicAddress(address))
  ) {
    const error = new Error(
      "Destination resolves to a restricted network address",
    );
    error.code = "ERR_BLOCKED_ADDRESS";
    throw error;
  }
  return addresses;
};

const withTimeout = (promise, timeoutMs) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(
      () =>
        reject(
          Object.assign(new Error("Request timed out"), { code: "ETIMEDOUT" }),
        ),
      timeoutMs,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });

const requestOnce = (url, addresses, timeoutMs) =>
  new Promise((resolve, reject) => {
    const transport = url.protocol === "https:" ? https : http;
    let settled = false;
    const done = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(totalTimer);
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
      },
      (response) => {
        const chunks = [];
        let size = 0;
        response.on("data", (chunk) => {
          size += chunk.length;
          if (size > env.HEALTH_CHECK_MAX_RESPONSE_BYTES) {
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
          }),
        );
        response.on("error", (error) => done(reject, error));
      },
    );
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
  const startedAt = Date.now();
  let currentUrl;
  let dnsDurationMs = 0;
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
      const dnsStartedAt = Date.now();
      const remainingMs = timeoutMs - (Date.now() - startedAt);
      if (remainingMs <= 0)
        throw Object.assign(new Error("Request timed out"), {
          code: "ETIMEDOUT",
        });
      const addresses = await withTimeout(
        resolvePublicAddresses(currentUrl.hostname),
        remainingMs,
      );
      dnsDurationMs += Date.now() - dnsStartedAt;
      const requestBudgetMs = timeoutMs - (Date.now() - startedAt);
      if (requestBudgetMs <= 0)
        throw Object.assign(new Error("Request timed out"), {
          code: "ETIMEDOUT",
        });
      const response = await requestOnce(
        currentUrl,
        addresses,
        requestBudgetMs,
      );
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
      const responseTime = Date.now() - startedAt;
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
          dns: { durationMs: dnsDurationMs },
          timing: { totalMs: responseTime, dnsMs: dnsDurationMs },
        },
      };
    }
    throw Object.assign(new Error("Too many redirects"), {
      code: "ERR_TOO_MANY_REDIRECTS",
    });
  } catch (error) {
    const responseTime = Date.now() - startedAt;
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
        dns: { durationMs: dnsDurationMs },
        timing: { totalMs: responseTime, dnsMs: dnsDurationMs },
        errorCode:
          errorCode === "ERR_BLOCKED_ADDRESS"
            ? "blocked_destination"
            : errorCode,
      },
    };
  }
};

export const poll = async (url, opts = {}) => {
  const timeout = opts.timeout ?? env.POLL_TIMEOUT_MS;
  const totalTimeout = opts.totalTimeout ?? env.POLL_TOTAL_TIMEOUT_MS;
  const maxRetries = opts.maxRetries ?? env.MONITOR_RETRY_COUNT;
  const retryDelay = opts.retryDelay ?? env.MONITOR_RETRY_DELAY;
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
      logger.debug("Retrying monitor request", {
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
      diagnostics: {
        timing: { totalMs: totalTimeout },
        errorCode: "ETIMEDOUT",
      },
    };
  }
  return result;
};
