/**
 * Poller
 * Performs HTTP GET against a monitor's URL with timeout, retries,
 * and exponential backoff.  Returns a normalised result object that
 * the classifier can consume without caring about network details.
 */

import env from "../config/env.js";
import logger from "../utils/logger.js";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Execute a single HTTP poll (no retries).
 * @param {string} url
 * @param {number} timeout — ms
 * @returns {Promise<PollResult>}
 */
const singlePoll = async (url, timeout) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  const startTime = Date.now();

  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "User-Agent": "WebsiteMonitor/1.0",
        Accept: "application/json",
      },
      redirect: "follow",
    });

    clearTimeout(timer);
    const responseTime = Date.now() - startTime;
    const httpStatus = response.status;

    // Attempt to read and parse the body
    let body = null;
    let failureReason = null;

    const text = await response.text();
    try {
      body = JSON.parse(text);
    } catch {
      failureReason = response.ok ? "invalid_json" : "http_error";
    }

    if (!response.ok && !failureReason) {
      failureReason = "http_error";
    }

    return {
      ok: response.ok,
      httpStatus,
      responseTime,
      body,
      error: response.ok ? null : `HTTP ${httpStatus}`,
      failureReason,
    };
  } catch (error) {
    clearTimeout(timer);
    const responseTime = Date.now() - startTime;

    let failureReason;
    if (error.name === "AbortError") {
      failureReason = "timeout";
    } else if (
      error.code === "ENOTFOUND" ||
      error.cause?.code === "ENOTFOUND"
    ) {
      failureReason = "dns_error";
    } else if (
      error.code === "ECONNREFUSED" ||
      error.cause?.code === "ECONNREFUSED"
    ) {
      failureReason = "connection_refused";
    } else {
      failureReason = "unknown";
    }

    return {
      ok: false,
      httpStatus: null,
      responseTime,
      body: null,
      error: error.message,
      failureReason,
    };
  }
};

/**
 * Poll a URL with retries and exponential backoff.
 *
 * @param {string} url
 * @param {Object} [opts]
 * @param {number} [opts.timeout]    — per-attempt timeout in ms
 * @param {number} [opts.maxRetries] — number of retries (total attempts = maxRetries + 1)
 * @param {number} [opts.retryDelay] — base delay in ms (doubles each retry)
 * @returns {Promise<PollResult>}
 *
 * @typedef {Object} PollResult
 * @property {boolean}     ok            — true if HTTP 2xx
 * @property {number|null} httpStatus    — HTTP status code or null on network error
 * @property {number}      responseTime  — ms for the final attempt
 * @property {Object|null} body          — parsed JSON or null
 * @property {string|null} error         — error message or null
 * @property {string|null} failureReason — from FAILURE_REASONS enum or null
 */
export const poll = async (url, opts = {}) => {
  const timeout = opts.timeout ?? env.POLL_TIMEOUT_MS;
  const maxRetries = opts.maxRetries ?? env.MONITOR_RETRY_COUNT;
  const retryDelay = opts.retryDelay ?? env.MONITOR_RETRY_DELAY;

  let result;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Exponential backoff between retries
    if (attempt > 0) {
      const delay = retryDelay * Math.pow(2, attempt - 1);
      logger.debug(
        `Retry ${attempt}/${maxRetries} for ${url} — waiting ${delay}ms`
      );
      await sleep(delay);
    }

    result = await singlePoll(url, timeout);

    // Success — return immediately
    if (result.ok) {
      return result;
    }

    // Last attempt — don't retry
    if (attempt === maxRetries) {
      break;
    }
  }

  return result;
};
