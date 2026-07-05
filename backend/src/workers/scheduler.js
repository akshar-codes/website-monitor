const Monitor = require("../models/Monitor");
const HealthCheck = require("../models/HealthCheck");
const env = require("../config/env");
const logger = require("../utils/logger");

const { poll } = require("./poller");
const { classify } = require("./classifier");
const { handleIncident } = require("./incidentManager");
const { updateDailyStat } = require("./aggregationManager");

let intervalId = null;
let isRunning = false;

// ─────────────────────────────────────────────
// Per-monitor pipeline
// ─────────────────────────────────────────────

const processMonitor = async (monitor) => {
  // 1. Poll the endpoint
  const pollResult = await poll(monitor.url);

  // 2. Classify the raw result
  const classification = classify(pollResult);

  // 3. Persist HealthCheck
  const healthCheck = await HealthCheck.create({
    monitor: monitor._id,
    status: classification.status,
    frontendStatus: classification.frontendStatus,
    backendStatus: classification.backendStatus,
    databaseStatus: classification.databaseStatus,
    responseTime: pollResult.responseTime,
    httpStatus: pollResult.httpStatus,
    failureReason: classification.failureReason,
    rawResponse: pollResult.body,
    checkedAt: new Date(),
  });

  // 4. Incident lifecycle
  await handleIncident(monitor, healthCheck);

  // 5. Daily aggregation
  await updateDailyStat(monitor, healthCheck);

  // 6. Advance the monitor's schedule
  await Monitor.findByIdAndUpdate(monitor._id, {
    lastCheckedAt: new Date(),
    nextCheckAt: new Date(Date.now() + monitor.interval * 1000),
  });

  logger.debug(
    `Checked "${monitor.name}" — ${classification.status} (${pollResult.responseTime}ms)`,
  );
};

// ─────────────────────────────────────────────
// Tick
// ─────────────────────────────────────────────

const tick = async () => {
  if (isRunning) {
    logger.debug("Previous tick still running — skipping");
    return;
  }

  isRunning = true;

  try {
    const dueMonitors = await Monitor.findDue();

    if (dueMonitors.length === 0) return;

    logger.debug(`Tick: ${dueMonitors.length} monitor(s) due`);

    const results = await Promise.allSettled(
      dueMonitors.map((m) => processMonitor(m)),
    );

    // Log any per-monitor failures (they shouldn't crash the scheduler)
    for (let i = 0; i < results.length; i++) {
      if (results[i].status === "rejected") {
        logger.error(
          `Failed to process monitor "${dueMonitors[i].name}": ${results[i].reason?.message || results[i].reason}`,
        );
      }
    }
  } catch (error) {
    logger.error(`Scheduler tick failed: ${error.message}`);
  } finally {
    isRunning = false;
  }
};

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────

/**
 * Start the scheduler.
 */
const start = () => {
  if (intervalId) {
    logger.warn("Scheduler already running");
    return;
  }

  const tickMs = env.POLL_TICK_MS;
  intervalId = setInterval(tick, tickMs);

  // Fire the first tick immediately so monitors don't wait for the first interval
  tick();

  logger.info(
    `Scheduler started — tick every ${tickMs / 1000}s, timeout ${env.POLL_TIMEOUT_MS / 1000}s, retries ${env.MONITOR_RETRY_COUNT}, failure threshold ${env.CONSECUTIVE_FAILURE_THRESHOLD}`,
  );
};

/**
 * Stop the scheduler gracefully.
 */
const stop = () => {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info("Scheduler stopped");
  }
};

module.exports = { start, stop };
