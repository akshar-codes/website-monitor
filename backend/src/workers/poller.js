/**
 * Poller
 * Performs HTTP GET against a monitor's URL with timeout, retries,
 * and exponential backoff.  Returns a normalised result object that
 * the classifier can consume without caring about network details.
 */

import env from "../config/env.js";
import logger from "../utils/logger.js";
import { FAILURE_REASONS } from "../config/constants.js";
import dns from "node:dns/promises";

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
  let dnsInfo = {
    hostname: new URL(url).hostname,
    addresses: [],
    durationMs: null,
    error: null,
  };
  try {
    const dnsStart = Date.now();
    const records = await dns.lookup(dnsInfo.hostname, { all: true });
    dnsInfo = {
      ...dnsInfo,
      addresses: records.map(({ address, family }) => ({ address, family })),
      durationMs: Date.now() - dnsStart,
    };
  } catch (error) {
    dnsInfo.error = error.code || error.message;
  }

  try {
    const redirects = [];
    let currentUrl = url;
    let response;
    for (let hop = 0; hop <= 10; hop++) {
      response = await fetch(currentUrl, {
        method: "GET",
        signal: controller.signal,
        headers: {
          "User-Agent": "WebsiteMonitor/1.0",
          Accept: "application/json",
        },
        redirect: "manual",
      });
      if (
        ![301, 302, 303, 307, 308].includes(response.status) ||
        !response.headers.get("location")
      )
        break;
      if (hop === 10) throw new Error("Too many redirects");
      const nextUrl = new URL(response.headers.get("location"), currentUrl)
        .href;
      redirects.push({
        url: currentUrl,
        status: response.status,
        location: nextUrl,
      });
      currentUrl = nextUrl;
    }

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
      failureReason = response.ok
        ? FAILURE_REASONS.INVALID_JSON
        : FAILURE_REASONS.HTTP_ERROR;
    }

    if (!response.ok && !failureReason) {
      failureReason = FAILURE_REASONS.HTTP_ERROR;
    }

    return {
      ok: response.ok,
      httpStatus,
      responseTime,
      body,
      error: response.ok ? null : `HTTP ${httpStatus}`,
      failureReason,
      diagnostics: {
        finalUrl: response.url || currentUrl,
        statusText: response.statusText,
        headers: Object.fromEntries(
          [...response.headers.entries()].filter(
            ([name]) => name !== "set-cookie",
          ),
        ),
        redirects,
        dns: dnsInfo,
        timing: { totalMs: responseTime, dnsMs: dnsInfo.durationMs },
      },
    };
  } catch (error) {
    clearTimeout(timer);
    const responseTime = Date.now() - startTime;

    let failureReason;
    if (error.name === "AbortError") {
      failureReason = FAILURE_REASONS.TIMEOUT;
    } else if (
      error.code === "ENOTFOUND" ||
      error.cause?.code === "ENOTFOUND"
    ) {
      failureReason = FAILURE_REASONS.DNS_ERROR;
    } else if (
      error.code === "ECONNREFUSED" ||
      error.cause?.code === "ECONNREFUSED"
    ) {
      failureReason = FAILURE_REASONS.CONNECTION_REFUSED;
    } else {
      failureReason = FAILURE_REASONS.UNKNOWN;
    }

    return {
      ok: false,
      httpStatus: null,
      responseTime,
      body: null,
      error: error.message,
      failureReason,
      diagnostics: {
        finalUrl: url,
        headers: {},
        redirects: [],
        dns: dnsInfo,
        timing: { totalMs: responseTime, dnsMs: dnsInfo.durationMs },
        errorCode: error.code || error.cause?.code || error.name,
      },
    };
  }
};

/**
 * Poll a URL with retries and exponential backoff.
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
        `Retry ${attempt}/${maxRetries} for ${url} — waiting ${delay}ms`,
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
