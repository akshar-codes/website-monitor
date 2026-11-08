import http from "node:http";
import https from "node:https";
import zlib from "node:zlib";
import { performance } from "node:perf_hooks";
import { FAILURE_REASONS } from "../config/constants.js";
import { decryptCredential } from "../utils/credentialEncryption.js";
import {
  cleanHostname,
  isPublicAddress,
  resolvePublicAddresses,
  createPinnedLookup,
} from "../utils/networkSecurity.js";

const REDIRECTS = new Set([301, 302, 303, 307, 308]);
const MAX_REDIRECTS = 3;
const MAX_REQUEST_BODY_BYTES = 64 * 1024; // 64 KB
const DEFAULT_MAX_RESPONSE_BYTES =
  Number(process.env.HEALTH_CHECK_MAX_RESPONSE_BYTES) || 1_048_576; // 1 MB
const DEFAULT_TIMEOUT_MS = Number(process.env.POLL_TIMEOUT_MS) || 10_000;
const DEFAULT_TOTAL_TIMEOUT_MS =
  Number(process.env.POLL_TOTAL_TIMEOUT_MS) || 30_000;

const SAFE_RESPONSE_HEADERS = new Set([
  "content-type",
  "content-length",
  "cache-control",
  "date",
  "server",
  "x-request-id",
  "etag",
  "last-modified",
]);

const FORBIDDEN_REQUEST_HEADERS = new Set([
  "host",
  "content-length",
  "transfer-encoding",
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "upgrade",
  "expect",
  "cookie",
  "set-cookie",
  "authorization",
]);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const toPlainMap = (value) =>
  value instanceof Map ? Object.fromEntries(value) : { ...(value || {}) };

/**
 * Validate header name and value to prevent HTTP request smuggling and CRLF injection.
 */
const validateHeaderSafe = (name, value) => {
  if (typeof name !== "string" || !name) return false;
  if (typeof value !== "string") return false;
  // Node's built-in header validation checks or regex for control characters
  if (http.validateHeaderName) {
    try {
      http.validateHeaderName(name);
      http.validateHeaderValue(name, value);
      return true;
    } catch {
      return false;
    }
  }
  return !/[\r\n]/.test(name) && !/[\r\n]/.test(value);
};

/**
 * Perform a single HTTP/HTTPS request attempt with streaming limits, IP pinning, and timing.
 */
const requestOnceApi = ({
  url,
  method,
  headers,
  bodyBuffer,
  addresses,
  timeoutMs,
  maxResponseBytes = DEFAULT_MAX_RESPONSE_BYTES,
}) =>
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
    let rawBytesReceived = 0;
    let decompressedBytesReceived = 0;
    let activeSocket = null;
    let decompressorStream = null;

    const cleanup = () => {
      clearTimeout(totalTimer);
    };

    const done = (fn, value) => {
      if (settled) return;
      settled = true;
      cleanup();

      if (fn === reject) {
        if (tlsStartedAt != null && timing.tlsHandshakeMs == null) {
          timing.tlsHandshakeMs = performance.now() - tlsStartedAt;
        }
        if (bodyStartedAt != null && timing.downloadMs == null) {
          timing.downloadMs = performance.now() - bodyStartedAt;
        }
        value.timings = timing;
      }
      fn(value);
    };

    const lookup = createPinnedLookup(addresses);

    const request = transport.request(
      url,
      {
        method,
        agent: false,
        lookup,
        headers,
      },
      (response) => {
        timing.ttfbMs = performance.now() - requestStarted;
        bodyStartedAt = performance.now();

        const contentEncoding = (
          response.headers["content-encoding"] || ""
        ).toLowerCase();
        let stream = response;

        if (contentEncoding === "gzip" || contentEncoding === "x-gzip") {
          decompressorStream = zlib.createGunzip();
        } else if (contentEncoding === "deflate") {
          decompressorStream = zlib.createInflate();
        } else if (contentEncoding === "br") {
          decompressorStream = zlib.createBrotliDecompress();
        }

        response.on("data", (chunk) => {
          rawBytesReceived += chunk.length;
          if (rawBytesReceived > maxResponseBytes) {
            const error = Object.assign(
              new Error("Response exceeds allowed size"),
              { code: "ERR_RESPONSE_TOO_LARGE" },
            );
            request.destroy(error);
            response.destroy(error);
            decompressorStream?.destroy(error);
            done(reject, error);
          }
        });

        if (decompressorStream) {
          decompressorStream.on("data", (chunk) => {
            decompressedBytesReceived += chunk.length;
            if (decompressedBytesReceived > maxResponseBytes) {
              const error = Object.assign(
                new Error("Decompressed response exceeds allowed size"),
                { code: "ERR_RESPONSE_TOO_LARGE" },
              );
              request.destroy(error);
              response.destroy(error);
              decompressorStream.destroy(error);
              done(reject, error);
            }
          });
          decompressorStream.on("error", (err) => {
            request.destroy(err);
            response.destroy(err);
            done(reject, err);
          });
          stream = response.pipe(decompressorStream);
        }

        const chunks = [];
        stream.on("data", (chunk) => {
          chunks.push(chunk);
        });

        stream.on("end", () => {
          const downloadMs = performance.now() - bodyStartedAt;
          const body = Buffer.concat(chunks).toString("utf8");
          done(resolve, {
            status: response.statusCode,
            headers: response.headers,
            safeHeaders: Object.fromEntries(
              Object.entries(response.headers).filter(([name]) =>
                SAFE_RESPONSE_HEADERS.has(name.toLowerCase()),
              ),
            ),
            body,
            location: response.headers.location,
            timing: {
              ...timing,
              downloadMs,
              totalMs: performance.now() - requestStarted,
            },
            rawBytesReceived,
          });
        });

        stream.on("error", (error) => {
          request.destroy(error);
          done(reject, error);
        });
      },
    );

    request.on("socket", (socket) => {
      activeSocket = socket;
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

      if (socket.connecting) {
        socket.once("connect", connected);
      } else {
        connected();
      }
    });

    const totalTimer = setTimeout(() => {
      const error = Object.assign(new Error("Request timed out"), {
        code: "ETIMEDOUT",
      });
      request.destroy(error);
      activeSocket?.destroy(error);
      done(reject, error);
    }, timeoutMs);

    request.setTimeout(timeoutMs, () => {
      const error = Object.assign(new Error("Connection timed out"), {
        code: "ETIMEDOUT",
      });
      request.destroy(error);
      activeSocket?.destroy(error);
      done(reject, error);
    });

    request.on("error", (error) => {
      activeSocket?.destroy(error);
      done(reject, error);
    });

    if (bodyBuffer && bodyBuffer.length > 0) {
      request.write(bodyBuffer);
    }
    request.end();
  });

/**
 * Execute a single poll of an API monitor with redirect management, SSRF protection, and DNS pinning.
 */
const singleApiPoll = async ({
  baseUrl,
  method,
  queryParams,
  secretQueryParamNames,
  customHeaders,
  secretHeaderNames,
  bodyString,
  authConfig,
  timeoutMs,
  maxResponseBytes,
  dnsResolve = resolvePublicAddresses,
}) => {
  const startedAt = performance.now();
  let currentUrl;
  const timings = {
    dnsMs: 0,
    tcpConnectMs: null,
    tlsHandshakeMs: null,
    ttfbMs: null,
    downloadMs: null,
    totalMs: 0,
  };
  const available = new Set();
  const redirects = [];

  // 1. Build and validate initial URL
  try {
    currentUrl = new URL(baseUrl);
    if (
      !["http:", "https:"].includes(currentUrl.protocol) ||
      currentUrl.username ||
      currentUrl.password
    ) {
      throw Object.assign(new Error("Unsupported monitor destination"), {
        code: "ERR_BLOCKED_ADDRESS",
      });
    }

    // Append query params safely
    for (const [key, val] of Object.entries(queryParams)) {
      currentUrl.searchParams.set(key, String(val));
    }
  } catch (error) {
    return {
      transportCompleted: false,
      httpStatus: null,
      responseTime: performance.now() - startedAt,
      failureReason: FAILURE_REASONS.UNSAFE_DESTINATION,
      failureCategory: "blocked_destination",
      safeFailureReason:
        "API URL destination is invalid or contains embedded credentials",
      timings: { ...timings, totalMs: performance.now() - startedAt },
      diagnostics: {
        method,
        finalHost: null,
        path: null,
        redirects: [],
        headers: {},
        errorCode: error.code || "ERR_BLOCKED_ADDRESS",
      },
    };
  }

  // 2. Prepare body buffer
  let bodyBuffer = null;
  if (["POST", "PUT", "PATCH"].includes(method) && bodyString) {
    bodyBuffer = Buffer.from(bodyString, "utf8");
    if (bodyBuffer.length > MAX_REQUEST_BODY_BYTES) {
      return {
        transportCompleted: false,
        httpStatus: null,
        responseTime: performance.now() - startedAt,
        failureReason: FAILURE_REASONS.INVALID_CONFIGURATION,
        failureCategory: "invalid_api_config",
        safeFailureReason:
          "API request body exceeds maximum allowed size (64 KB)",
        timings: { ...timings, totalMs: performance.now() - startedAt },
        diagnostics: {
          method,
          finalHost: cleanHostname(currentUrl.hostname),
          path: currentUrl.pathname,
          redirects: [],
          headers: {},
          errorCode: "request_body_too_large",
        },
      };
    }
  }

  // 3. Prepare headers
  const activeHeaders = {};
  for (const [name, val] of Object.entries(customHeaders)) {
    const lower = name.toLowerCase();
    if (FORBIDDEN_REQUEST_HEADERS.has(lower)) continue;
    if (!validateHeaderSafe(name, String(val))) {
      return {
        transportCompleted: false,
        httpStatus: null,
        responseTime: performance.now() - startedAt,
        failureReason: FAILURE_REASONS.INVALID_CONFIGURATION,
        failureCategory: "invalid_api_config",
        safeFailureReason: `Header "${name}" is malformed or violates framing security policy`,
        timings: { ...timings, totalMs: performance.now() - startedAt },
        diagnostics: {
          method,
          finalHost: cleanHostname(currentUrl.hostname),
          path: currentUrl.pathname,
          redirects: [],
          headers: {},
          errorCode: "invalid_header",
        },
      };
    }
    activeHeaders[name] = String(val);
  }

  // Standard defaults
  if (!activeHeaders["User-Agent"] && !activeHeaders["user-agent"]) {
    activeHeaders["User-Agent"] = "WebsiteMonitor-Api/1.0";
  }
  if (!activeHeaders["Accept"] && !activeHeaders["accept"]) {
    activeHeaders["Accept"] = "application/json, text/plain, */*";
  }
  if (!activeHeaders["Accept-Encoding"] && !activeHeaders["accept-encoding"]) {
    activeHeaders["Accept-Encoding"] = "gzip, deflate, br, identity";
  }

  if (bodyBuffer) {
    if (!activeHeaders["Content-Type"] && !activeHeaders["content-type"]) {
      try {
        JSON.parse(bodyString);
        activeHeaders["Content-Type"] = "application/json; charset=utf-8";
      } catch {
        activeHeaders["Content-Type"] = "text/plain; charset=utf-8";
      }
    }
    activeHeaders["Content-Length"] = String(bodyBuffer.length);
  }

  // In-memory Authentication header
  let authHeaderValue = null;
  if (authConfig?.mode === "bearer" && authConfig.token) {
    authHeaderValue = `Bearer ${authConfig.token}`;
    activeHeaders["Authorization"] = authHeaderValue;
  } else if (
    authConfig?.mode === "basic" &&
    authConfig.username &&
    authConfig.password
  ) {
    const cred = Buffer.from(
      `${authConfig.username}:${authConfig.password}`,
    ).toString("base64");
    authHeaderValue = `Basic ${cred}`;
    activeHeaders["Authorization"] = authHeaderValue;
  }

  const initialOrigin = currentUrl.origin;

  // 4. Execution Loop (Handles GET redirects with origin stripping and DNS re-validation)
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const remainingMs = timeoutMs - (performance.now() - startedAt);
      if (remainingMs <= 0) {
        throw Object.assign(new Error("Request timed out"), {
          code: "ETIMEDOUT",
        });
      }

      // DNS Resolution with timeout budget
      const dnsStartedAt = performance.now();
      const abortController = new AbortController();
      const dnsTimeout = setTimeout(
        () => abortController.abort(),
        Math.min(remainingMs, 5000),
      );

      let addresses;
      try {
        addresses = await dnsResolve(
          currentUrl.hostname,
          remainingMs,
          abortController.signal,
        );
      } finally {
        clearTimeout(dnsTimeout);
        timings.dnsMs += performance.now() - dnsStartedAt;
      }

      const requestBudgetMs = timeoutMs - (performance.now() - startedAt);
      if (requestBudgetMs <= 0) {
        throw Object.assign(new Error("Request timed out"), {
          code: "ETIMEDOUT",
        });
      }

      // Execute single HTTP attempt
      const response = await requestOnceApi({
        url: currentUrl,
        method,
        headers: activeHeaders,
        bodyBuffer,
        addresses,
        timeoutMs: requestBudgetMs,
        maxResponseBytes,
      });

      for (const key of [
        "tcpConnectMs",
        "tlsHandshakeMs",
        "ttfbMs",
        "downloadMs",
      ]) {
        if (response.timing[key] != null) {
          timings[key] = (timings[key] || 0) + response.timing[key];
          available.add(key);
        }
      }

      // Redirect Handling
      if (REDIRECTS.has(response.status) && response.location) {
        // Redirects are strictly disabled for non-GET methods
        if (method !== "GET") {
          const responseTime = performance.now() - startedAt;
          timings.totalMs = responseTime;
          return {
            transportCompleted: true,
            httpStatus: response.status,
            responseTime,
            timings,
            headers: response.headers,
            body: response.body,
            failureReason: null,
            failureCategory: "none",
            safeFailureReason: null,
            diagnostics: {
              method,
              finalHost: cleanHostname(currentUrl.hostname),
              path: currentUrl.pathname,
              headers: response.safeHeaders || response.headers,
              redirects,
              timing: timings,
            },
          };
        }

        if (hop === MAX_REDIRECTS) {
          throw Object.assign(new Error("Too many redirects"), {
            code: "ERR_TOO_MANY_REDIRECTS",
          });
        }

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

        // Cycle check
        const visitedUrls = new Set(redirects.map((r) => r.url));
        if (visitedUrls.has(nextUrl.href)) {
          throw Object.assign(new Error("Redirect loop detected"), {
            code: "ERR_TOO_MANY_REDIRECTS",
          });
        }

        redirects.push({
          status: response.status,
          destinationHost: cleanHostname(nextUrl.hostname),
          url: nextUrl.href,
        });

        // Strip credentials on cross-origin redirects
        if (nextUrl.origin !== initialOrigin) {
          delete activeHeaders["Authorization"];
          delete activeHeaders["authorization"];
          delete activeHeaders["Cookie"];
          delete activeHeaders["cookie"];
          for (const secName of secretHeaderNames || []) {
            delete activeHeaders[secName];
          }
        }

        currentUrl = nextUrl;
        continue;
      }

      // Final response reached
      const responseTime = performance.now() - startedAt;
      timings.totalMs = responseTime;
      const serializedTimings = Object.fromEntries(
        Object.entries(timings).map(([k, v]) => [
          k,
          v != null ? Number(v.toFixed(2)) : null,
        ]),
      );

      return {
        transportCompleted: true,
        httpStatus: response.status,
        responseTime,
        timings: serializedTimings,
        headers: response.headers,
        body: response.body,
        failureReason: null,
        failureCategory: "none",
        safeFailureReason: null,
        diagnostics: {
          method,
          finalHost: cleanHostname(currentUrl.hostname),
          path: currentUrl.pathname,
          headers: response.safeHeaders || response.headers,
          redirects: redirects.map(({ status, destinationHost }) => ({
            status,
            destinationHost,
          })),
          timing: serializedTimings,
        },
      };
    }

    throw Object.assign(new Error("Too many redirects"), {
      code: "ERR_TOO_MANY_REDIRECTS",
    });
  } catch (error) {
    const responseTime = performance.now() - startedAt;
    timings.totalMs = responseTime;
    const serializedTimings = Object.fromEntries(
      Object.entries(timings).map(([k, v]) => [
        k,
        v != null ? Number(v.toFixed(2)) : null,
      ]),
    );

    const errorCode = error.code || error.cause?.code || "UNKNOWN";
    let failureReason = FAILURE_REASONS.UNKNOWN;
    let failureCategory = "unknown";
    let safeFailureReason = error.message || "Request execution failed";

    if (errorCode === "ENOTFOUND" || errorCode === "EAI_AGAIN") {
      failureReason = FAILURE_REASONS.DNS_ERROR;
      failureCategory = "dns_failure";
      safeFailureReason = "DNS resolution failed for target host";
    } else if (errorCode === "ETIMEDOUT") {
      failureReason = FAILURE_REASONS.TIMEOUT;
      failureCategory = "timeout";
      safeFailureReason = "Request timed out";
    } else if (
      errorCode === "ECONNREFUSED" ||
      errorCode === "ECONNRESET" ||
      errorCode === "EPIPE"
    ) {
      failureReason = FAILURE_REASONS.CONNECTION_REFUSED;
      failureCategory = "connection_failure";
      safeFailureReason = "Connection was refused or reset by remote server";
    } else if (errorCode === "ERR_BLOCKED_ADDRESS") {
      failureReason = FAILURE_REASONS.UNSAFE_DESTINATION;
      failureCategory = "blocked_destination";
      safeFailureReason =
        "Destination resolves to a restricted or private address";
    } else if (errorCode === "ERR_TOO_MANY_REDIRECTS") {
      failureReason = FAILURE_REASONS.REDIRECT_ERROR;
      failureCategory = "redirect_error";
      safeFailureReason = "Too many redirects or redirect loop detected";
    } else if (errorCode === "ERR_RESPONSE_TOO_LARGE") {
      failureReason = FAILURE_REASONS.RESPONSE_TOO_LARGE;
      failureCategory = "response_too_large";
      safeFailureReason = "Response exceeded allowed size limit (1 MB)";
    } else if (
      errorCode.startsWith("ERR_TLS_") ||
      errorCode.startsWith("CERT_") ||
      errorCode === "DEPTH_ZERO_SELF_SIGNED_CERT" ||
      errorCode === "UNABLE_TO_VERIFY_LEAF_SIGNATURE"
    ) {
      failureReason = FAILURE_REASONS.TLS_ERROR;
      failureCategory = "tls_failure";
      safeFailureReason = "TLS handshake or certificate verification failed";
    }

    return {
      transportCompleted: false,
      httpStatus: null,
      responseTime,
      timings: serializedTimings,
      headers: {},
      failureReason,
      failureCategory,
      safeFailureReason,
      diagnostics: {
        method,
        finalHost: currentUrl ? cleanHostname(currentUrl.hostname) : null,
        path: currentUrl ? currentUrl.pathname : null,
        headers: {},
        redirects: redirects.map(({ status, destinationHost }) => ({
          status,
          destinationHost,
        })),
        timing: serializedTimings,
        errorCode,
      },
    };
  }
};

/**
 * Main API request execution engine entry point.
 * Resolves credentials, builds request parameters, applies method-specific retry policy,
 * and executes outbound network requests with guaranteed safety.
 */
export const executeApiMonitor = async (monitor, options = {}) => {
  const apiConfig = monitor.apiConfig || {};
  const method = String(apiConfig.method || "GET").toUpperCase();

  // Decrypt credentials safely in memory
  let queryParams = toPlainMap(apiConfig.queryParams);
  let customHeaders = toPlainMap(apiConfig.headers);
  let bodyString = null;
  const authConfig = { mode: apiConfig.authentication?.mode || "none" };

  try {
    // 1. Decrypt query params
    const encQueryParams = toPlainMap(apiConfig.encryptedQueryParams);
    for (const [key, cipher] of Object.entries(encQueryParams)) {
      if (cipher) {
        queryParams[key] = decryptCredential(cipher);
      }
    }

    // 2. Decrypt custom headers
    const encHeaders = toPlainMap(apiConfig.encryptedHeaders);
    for (const [key, cipher] of Object.entries(encHeaders)) {
      if (cipher) {
        customHeaders[key] = decryptCredential(cipher);
      }
    }

    // 3. Decrypt body
    if (apiConfig.encryptedBody) {
      bodyString = decryptCredential(apiConfig.encryptedBody);
    }

    // 4. Decrypt authentication
    if (authConfig.mode === "bearer") {
      const ciphertext = apiConfig.authentication?.credentialCiphertext;
      if (!ciphertext) throw new Error("Missing bearer token ciphertext");
      authConfig.token = decryptCredential(ciphertext);
    } else if (authConfig.mode === "basic") {
      const username = apiConfig.authentication?.username;
      const ciphertext = apiConfig.authentication?.credentialCiphertext;
      if (!username || !ciphertext) {
        throw new Error("Missing basic auth username or password ciphertext");
      }
      authConfig.username = username;
      authConfig.password = decryptCredential(ciphertext);
    }
  } catch (decryptionError) {
    return {
      transportCompleted: false,
      httpStatus: null,
      responseTime: 0,
      timings: {
        dnsMs: null,
        tcpConnectMs: null,
        tlsHandshakeMs: null,
        ttfbMs: null,
        downloadMs: null,
        totalMs: 0,
      },
      headers: {},
      failureReason: FAILURE_REASONS.INVALID_CONFIGURATION,
      failureCategory: "invalid_api_config",
      safeFailureReason:
        "API credentials could not be decrypted or configuration is corrupt",
      diagnostics: {
        method,
        finalHost: null,
        path: null,
        redirects: [],
        headers: {},
        timing: null,
        errorCode: "credential_decryption_failed",
      },
    };
  }

  // Timeouts & retries configuration
  const configuredMaxMs =
    Number(apiConfig.maxResponseTimeMs) || DEFAULT_TIMEOUT_MS;
  const timeout = Math.min(
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    configuredMaxMs,
  );
  const totalTimeout = options.totalTimeoutMs ?? DEFAULT_TOTAL_TIMEOUT_MS;

  // Retry Policy: strictly 0 retries for mutating methods; bounded retries for GET on eligible failures
  const isSafeMethod = method === "GET";
  const maxRetries = isSafeMethod ? (options.maxRetries ?? 1) : 0;
  const deadline = Date.now() + totalTimeout;

  let result;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;

    if (attempt > 0) {
      const delay = Math.min(1000 * 2 ** (attempt - 1), remaining, 5000);
      await sleep(delay);
    }

    const attemptBudget = Math.min(timeout, deadline - Date.now());
    if (attemptBudget <= 0) break;

    result = await singleApiPoll({
      baseUrl: monitor.url,
      method,
      queryParams,
      secretQueryParamNames: apiConfig.secretQueryParamNames || [],
      customHeaders,
      secretHeaderNames: apiConfig.secretHeaderNames || [],
      bodyString,
      authConfig,
      timeoutMs: attemptBudget,
      dnsResolve: options.dnsResolve,
    });

    // If request completed (even if non-expected status) or unsafe destination: do not retry
    if (
      result.transportCompleted ||
      result.failureReason === FAILURE_REASONS.UNSAFE_DESTINATION ||
      result.failureReason === FAILURE_REASONS.INVALID_CONFIGURATION
    ) {
      return result;
    }
  }

  return (
    result || {
      transportCompleted: false,
      httpStatus: null,
      responseTime: totalTimeout,
      timings: {
        dnsMs: null,
        tcpConnectMs: null,
        tlsHandshakeMs: null,
        ttfbMs: null,
        downloadMs: null,
        totalMs: totalTimeout,
      },
      headers: {},
      failureReason: FAILURE_REASONS.TIMEOUT,
      failureCategory: "timeout",
      safeFailureReason: "API monitor execution exceeded total timeout",
      diagnostics: {
        method,
        finalHost: null,
        path: null,
        redirects: [],
        headers: {},
        timing: { totalMs: totalTimeout },
        errorCode: "ETIMEDOUT",
      },
    }
  );
};
