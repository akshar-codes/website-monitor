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

let intervalId = null;
let isRunning = false;

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
    const dueMonitors = await Monitor.findDueSsl();

    if (dueMonitors.length === 0) return;

    logger.debug(`SSL tick: ${dueMonitors.length} monitor(s) due`);

    const results = await Promise.allSettled(
      dueMonitors.map((m) => runAndPersistCheck(m)),
    );

    for (let i = 0; i < results.length; i++) {
      if (results[i].status === "rejected") {
        logger.error(
          `Failed SSL check for monitor "${dueMonitors[i].name}": ${
            results[i].reason?.message || results[i].reason
          }`,
        );
      }
    }
  } catch (error) {
    logger.error(`SSL scheduler tick failed: ${error.message}`);
  } finally {
    isRunning = false;
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
  intervalId = setInterval(tick, tickMs);

  // First tick fires shortly after startup, not immediately — gives the
  // health-check scheduler priority during the noisy startup window,
  // since SSL/domain data is never as time-sensitive as live uptime.
  setTimeout(tick, 5_000);

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
};
