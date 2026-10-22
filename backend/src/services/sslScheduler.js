/**
 * SSL / domain check scheduler
 *
 * Deliberately a SEPARATE tick loop from workers/scheduler.js (the HTTP
 * health-check scheduler) — SSL/domain checks are far more expensive
 * (a real TLS handshake plus an outbound RDAP HTTP request per monitor)
 * and change far more slowly (a certificate's expiry doesn't move
 * between 10-second polls), so running them on the same hot loop as
 * health checks would waste resources and add latency to the thing that
 * actually needs sub-minute freshness. Each monitor is instead rechecked
 * on its own multi-hour cadence (env.SSL_CHECK_INTERVAL_MS), and this
 * loop only wakes up periodically (env.SSL_CHECK_TICK_MS) to see which
 * monitors are due — the same due-query + isRunning-guard pattern
 * workers/scheduler.js already uses for health checks.
 */

import Monitor from "../models/Monitor.js";
import env from "../config/env.js";
import logger from "../utils/logger.js";
import { runAndPersistCheck } from "../services/ssl.service.js";
import { consumeWithConcurrency } from "../workers/boundedWorkerPool.js";

let intervalId = null;
let isRunning = false;
let tickPromise = null;
let startupTimer = null;

// ─────────────────────────────────────────────
// Tick
// ─────────────────────────────────────────────

const tick = async () => {
  if (isRunning) {
    logger.debug("Previous SSL check tick still running — skipping");
    return;
  }

  isRunning = true;

  try {
    const dueMonitors = Monitor.findDueSsl()
      .sort({ nextSslCheckAt: 1, _id: 1 })
      .cursor({ batchSize: env.SSL_CHECK_CONCURRENCY });
    const count = await consumeWithConcurrency(
      dueMonitors,
      env.SSL_CHECK_CONCURRENCY,
      (monitor) => runAndPersistCheck(monitor),
      (error, monitor) =>
        logger.error("SSL monitor check failed", {
          monitorId: String(monitor._id),
          error: error.message,
        }),
    );
    logger.debug("SSL scheduler tick completed", { checksCompleted: count });
  } catch (error) {
    logger.error(`SSL scheduler tick failed: ${error.message}`);
  } finally {
    isRunning = false;
    tickPromise = null;
  }
};

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────

/**
 * Start the SSL scheduler.
 */
export const start = () => {
  if (intervalId) {
    logger.warn("SSL scheduler already running");
    return;
  }

  const tickMs = env.SSL_CHECK_TICK_MS;
  intervalId = setInterval(() => {
    if (!tickPromise) tickPromise = tick();
  }, tickMs);

  // First tick fires shortly after startup, not immediately — gives the
  // health-check scheduler priority during the noisy startup window,
  // since SSL/domain data is never as time-sensitive as live uptime.
  startupTimer = setTimeout(() => {
    if (!tickPromise) tickPromise = tick();
  }, 5_000);
  startupTimer.unref?.();

  logger.info(
    `SSL scheduler started — tick every ${tickMs / 1000}s, recheck interval ${
      env.SSL_CHECK_INTERVAL_MS / (60 * 60 * 1000)
    }h`,
  );
};

/**
 * Stop the SSL scheduler gracefully.
 */
export const stop = () => {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info("SSL scheduler stopped");
  }
  if (startupTimer) clearTimeout(startupTimer);
  startupTimer = null;
  return tickPromise || Promise.resolve();
};
