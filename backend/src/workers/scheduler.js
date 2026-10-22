import { randomUUID } from "node:crypto";
import Monitor from "../models/Monitor.js";
import HealthCheck from "../models/HealthCheck.js";
import env from "../config/env.js";
import logger from "../utils/logger.js";
import { poll } from "./poller.js";
import { classify } from "./classifier.js";
import { handleIncident } from "./incidentManager.js";
import { updateDailyStat } from "./aggregationManager.js";
import { runRetentionPass } from "./retentionManager.js";
import { logActivity } from "../utils/activityLogger.js";
import {
  ACTIVITY_CATEGORIES,
  ACTIVITY_ACTIONS,
} from "../config/activityConstants.js";

let intervalId = null;
let stopped = true;
let tickPromise = null;
let maintenanceTimer = null;
let maintenancePromise = null;
let metricsTimer = null;
let lastMetricsAt = 0;
const metrics = {
  checksCompleted: 0,
  unhealthyChecks: 0,
  jobErrors: 0,
  schedulerErrors: 0,
  totalExecutionMs: 0,
  lastCheckAt: null,
  lastSchedulerSuccessAt: null,
  queueDepth: 0,
};
const inFlightMonitorIds = new Set();
const activeTasks = new Set();

const processMonitor = async (monitor, initiatedBy = null) => {
  const id = String(monitor._id);
  if (inFlightMonitorIds.has(id)) return null;
  inFlightMonitorIds.add(id);
  const startedAt = Date.now();
  try {
    const pollResult = await poll(monitor.url);
    const classification = classify(pollResult);
    const checkedAt = new Date();
    const executionKey = initiatedBy
      ? `manual:${randomUUID()}`
      : `scheduled:${id}:${monitor.nextCheckAt ? new Date(monitor.nextCheckAt).toISOString() : "immediate"}`;
    const healthCheck = await HealthCheck.findOneAndUpdate(
      { executionKey },
      {
        $setOnInsert: {
          executionKey,
          monitor: monitor._id,
          status: classification.status,
          frontendStatus: classification.frontendStatus,
          backendStatus: classification.backendStatus,
          databaseStatus: classification.databaseStatus,
          responseTime: pollResult.responseTime,
          intervalSeconds: monitor.interval,
          scheduled: true,
          httpStatus: pollResult.httpStatus,
          failureReason: classification.failureReason,
          rawResponse: null,
          diagnostics: pollResult.diagnostics,
          checkedAt,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    await handleIncident(monitor, healthCheck);
    await updateDailyStat(monitor, healthCheck);
    if (initiatedBy) {
      await Monitor.findByIdAndUpdate(monitor._id, {
        lastCheckedAt: new Date(),
        nextCheckAt: new Date(Date.now() + monitor.interval * 1000),
      });
    }
    if (initiatedBy) {
      await logActivity({
        userId: initiatedBy.id || initiatedBy._id,
        category: ACTIVITY_CATEGORIES.ADMIN,
        action: ACTIVITY_ACTIONS.ADMIN_MONITOR_CHECK_TRIGGERED,
        description: `Triggered a manual health check for monitor "${monitor.name}"`,
        entityType: "Monitor",
        entityId: monitor._id,
        metadata: {
          targetOwner: String(monitor.owner),
          status: classification.status,
        },
      });
    }
    logger.info("Monitor check completed", {
      monitorId: id,
      status: classification.status,
      responseTimeMs: pollResult.responseTime,
      durationMs: Date.now() - startedAt,
    });
    return healthCheck;
  } finally {
    inFlightMonitorIds.delete(id);
  }
};

export const runMonitorCheck = async (monitorId, initiatedBy) => {
  const monitor = await Monitor.findById(monitorId);
  if (!monitor) return null;
  return processMonitor(monitor, initiatedBy);
};

// Claim each due job with one atomic MongoDB update. All replicas compete for
// the same document; only one receives the lease token and may run the check.
export const claimNextDueMonitor = async (deps = {}) => {
  const monitorModel = deps.Monitor || Monitor;
  const now = deps.now || new Date();
  const token = deps.token || randomUUID();
  return monitorModel
    .findOneAndUpdate(
      {
        active: true,
        nextCheckAt: { $lte: now },
        $and: [
          {
            $or: [
              { checkLeaseUntil: null },
              { checkLeaseUntil: { $exists: false } },
              { checkLeaseUntil: { $lte: now } },
            ],
          },
          {
            $or: [
              { checkRetryAt: null },
              { checkRetryAt: { $exists: false } },
              { checkRetryAt: { $lte: now } },
            ],
          },
        ],
      },
      {
        $set: {
          checkLeaseToken: token,
          checkLeaseUntil: new Date(now.getTime() + env.MONITOR_JOB_LEASE_MS),
        },
      },
      {
        sort: { nextCheckAt: 1, _id: 1 },
        new: true,
        select: "+checkLeaseToken",
      },
    )
    .then((monitor) => (monitor ? { monitor, token } : null));
};

const runClaimedMonitor = async ({ monitor, token }) => {
  const id = String(monitor._id);
  const startedAt = Date.now();
  const query = { _id: monitor._id, checkLeaseToken: token };
  let timeout;
  let heartbeat;
  let work;
  try {
    heartbeat = setInterval(
      () => {
        Monitor.updateOne(query, {
          $set: {
            checkLeaseUntil: new Date(Date.now() + env.MONITOR_JOB_LEASE_MS),
          },
        }).catch((error) =>
          logger.error("Monitor lease renewal failed", {
            monitorId: id,
            error: error.message,
          }),
        );
      },
      Math.max(1_000, Math.floor(env.MONITOR_JOB_LEASE_MS / 3)),
    );
    heartbeat.unref?.();
    // Bound total work time as well as each network attempt. The promise is
    // still observed if the database stalls, keeping the job lease until its
    // underlying operations settle instead of permitting overlapping work.
    work = processMonitor(monitor);
    const deadline = new Promise((_, reject) => {
      timeout = setTimeout(
        () => reject(new Error("Monitor job exceeded its timeout")),
        env.MONITOR_JOB_LEASE_MS - 5_000,
      );
      timeout.unref?.();
    });
    const completed = await Promise.race([work, deadline]);
    metrics.checksCompleted += 1;
    if (completed && completed.status !== "up") metrics.unhealthyChecks += 1;
    metrics.totalExecutionMs += Date.now() - startedAt;
    metrics.lastCheckAt = new Date();
    const latest = await Monitor.findById(monitor._id)
      .select("active interval")
      .lean();
    await Monitor.updateOne(query, {
      $set: {
        lastCheckedAt: new Date(),
        ...(latest?.active
          ? { nextCheckAt: new Date(Date.now() + latest.interval * 1000) }
          : {}),
      },
      $unset: { checkLeaseToken: 1, checkLeaseUntil: 1, checkRetryAt: 1 },
    });
  } catch (error) {
    metrics.jobErrors += 1;
    if (work && error.message === "Monitor job exceeded its timeout") {
      // The poll pipeline has no safe cancellation point for its database
      // writes. Keep ownership until it settles, then apply the retry policy.
      await work.catch(() => {});
    }
    logger.error("Monitor job failed", {
      monitorId: id,
      monitorName: monitor.name,
      error: error.message,
    });
    await Monitor.updateOne(query, {
      $set: {
        checkRetryAt: new Date(Date.now() + env.MONITOR_JOB_RETRY_DELAY_MS),
      },
      $unset: { checkLeaseToken: 1, checkLeaseUntil: 1 },
    });
  } finally {
    clearTimeout(timeout);
    clearInterval(heartbeat);
  }
};

const tick = async () => {
  if (stopped || tickPromise) return tickPromise;
  tickPromise = (async () => {
    const available = Math.max(
      0,
      env.MONITOR_JOB_CONCURRENCY - activeTasks.size,
    );
    const claims = await Promise.all(
      Array.from({ length: available }, () => claimNextDueMonitor()),
    );
    metrics.lastSchedulerSuccessAt = new Date();
    for (const claim of claims.filter(Boolean)) {
      const task = runClaimedMonitor(claim)
        .catch((error) => {
          logger.error("Monitor job cleanup failed", {
            monitorId: String(claim.monitor._id),
            error: error.message,
          });
        })
        .finally(() => {
          activeTasks.delete(task);
          if (!stopped) setImmediate(tick);
        });
      activeTasks.add(task);
    }
  })()
    .catch((error) => {
      metrics.schedulerErrors += 1;
      logger.error("Scheduler dispatch failed", { error: error.message });
    })
    .finally(() => {
      tickPromise = null;
    });
  return tickPromise;
};

const runMaintenance = async () => {
  if (stopped || maintenancePromise) return maintenancePromise;
  maintenancePromise = runRetentionPass()
    .then((result) => {
      logger.info("Monitoring retention pass completed", result);
      return result;
    })
    .catch((error) => {
      logger.error("Monitoring retention pass failed", {
        error: error.message,
      });
    })
    .finally(() => {
      maintenancePromise = null;
    });
  return maintenancePromise;
};

const emitOperationalMetrics = async () => {
  const currentTime = Date.now();
  if (currentTime - lastMetricsAt < 60_000 || stopped) return;
  lastMetricsAt = currentTime;
  try {
    metrics.queueDepth = await Monitor.countDocuments({
      active: true,
      nextCheckAt: { $lte: new Date() },
      $and: [
        {
          $or: [
            { checkLeaseUntil: null },
            { checkLeaseUntil: { $exists: false } },
            { checkLeaseUntil: { $lte: new Date() } },
          ],
        },
        {
          $or: [
            { checkRetryAt: null },
            { checkRetryAt: { $exists: false } },
            { checkRetryAt: { $lte: new Date() } },
          ],
        },
      ],
    });
    logger.info("Monitoring scheduler metrics", {
      ...metrics,
      activeJobs: activeTasks.size,
      averageExecutionMs: metrics.checksCompleted
        ? Math.round(metrics.totalExecutionMs / metrics.checksCompleted)
        : 0,
    });
  } catch (error) {
    metrics.schedulerErrors += 1;
    logger.error("Monitoring metrics collection failed", {
      error: error.message,
    });
  }
};

export const getSchedulerMetrics = () => ({
  ...metrics,
  activeJobs: activeTasks.size,
  concurrencyLimit: env.MONITOR_JOB_CONCURRENCY,
});

export const start = () => {
  if (!stopped) {
    logger.warn("Scheduler already running");
    return;
  }
  stopped = false;
  intervalId = setInterval(tick, env.POLL_TICK_MS);
  intervalId.unref?.();
  metricsTimer = setInterval(emitOperationalMetrics, 15_000);
  metricsTimer.unref?.();
  maintenanceTimer = setInterval(
    runMaintenance,
    env.MONITOR_MAINTENANCE_INTERVAL_MS,
  );
  maintenanceTimer.unref?.();
  void tick(); // overdue work is recovered immediately after startup
  void runMaintenance();
  logger.info("Monitoring scheduler started", {
    tickMs: env.POLL_TICK_MS,
    concurrency: env.MONITOR_JOB_CONCURRENCY,
    leaseMs: env.MONITOR_JOB_LEASE_MS,
    pollTimeoutMs: env.POLL_TIMEOUT_MS,
    retries: env.MONITOR_RETRY_COUNT,
  });
};

export const stop = async () => {
  stopped = true;
  if (intervalId) clearInterval(intervalId);
  if (metricsTimer) clearInterval(metricsTimer);
  if (maintenanceTimer) clearInterval(maintenanceTimer);
  intervalId = null;
  metricsTimer = null;
  maintenanceTimer = null;
  await tickPromise;
  await maintenancePromise;
  await Promise.allSettled([...activeTasks]);
  logger.info("Monitoring scheduler stopped", { activeJobs: activeTasks.size });
};
