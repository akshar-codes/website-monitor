import DailyStat from "../models/DailyStat.js";
import HealthCheck from "../models/HealthCheck.js";
import { startOfDayUTC } from "../utils/dateUtils.js";
import { HEALTH_STATUS } from "../config/constants.js";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Daily rules (all timestamps and buckets are UTC): uptime is measured only
 * from returned samples; missing scheduled samples are uncovered, never up.
 * Coverage compares observed checks with expected schedule slots over the
 * monitor's eligible portion of that UTC day. Downtime is explicitly an
 * estimate, using each sample's configured interval and capped to the day.
 */
export const summarizeChecks = (checks, monitor, day, now = new Date()) => {
  const date = startOfDayUTC(day);
  const dayEnd = new Date(date.getTime() + DAY_MS);
  const startedAt = monitor.createdAt ? new Date(monitor.createdAt) : date;
  const periodStart = new Date(Math.max(date.getTime(), startedAt.getTime()));
  const periodEnd = new Date(Math.min(dayEnd.getTime(), now.getTime()));
  const elapsedSeconds = Math.max(0, (periodEnd - periodStart) / 1000);
  const intervalSeconds = Math.max(1, Number(monitor.interval) || 300);
  const scheduledIntervals = checks
    .filter((check) => check.scheduled !== false)
    .map((check) =>
      Math.max(1, Number(check.intervalSeconds) || intervalSeconds),
    );
  const expectedInterval = scheduledIntervals.length
    ? scheduledIntervals.reduce((sum, value) => sum + value, 0) /
      scheduledIntervals.length
    : intervalSeconds;
  const expectedChecks =
    elapsedSeconds > 0 || scheduledIntervals.length
      ? Math.max(1, Math.ceil(elapsedSeconds / expectedInterval))
      : 0;

  let successfulChecks = 0;
  let failedChecks = 0;
  let degradedChecks = 0;
  let unknownChecks = 0;
  let responseTimeSum = 0;
  let minResponseTime = Infinity;
  let maxResponseTime = 0;
  let estimatedDowntimeSeconds = 0;
  let estimatedDegradedSeconds = 0;
  let estimatedObservedSeconds = 0;
  let scheduledChecks = 0;
  let lastCheckAt = null;

  for (const check of checks) {
    const rt = Math.max(0, Number(check.responseTime) || 0);
    responseTimeSum += rt;
    minResponseTime = Math.min(minResponseTime, rt);
    maxResponseTime = Math.max(maxResponseTime, rt);
    if (!lastCheckAt || new Date(check.checkedAt) > lastCheckAt)
      lastCheckAt = new Date(check.checkedAt);
    const coveredSeconds = Math.max(
      1,
      Number(check.intervalSeconds) || intervalSeconds,
    );
    const isScheduled = check.scheduled !== false;
    if (isScheduled) {
      scheduledChecks += 1;
      estimatedObservedSeconds += coveredSeconds;
    }
    if (check.status === HEALTH_STATUS.UP) successfulChecks += 1;
    else if (check.status === HEALTH_STATUS.DOWN) {
      failedChecks += 1;
      if (isScheduled) estimatedDowntimeSeconds += coveredSeconds;
    } else if (check.status === HEALTH_STATUS.DEGRADED) {
      degradedChecks += 1;
      if (isScheduled) estimatedDegradedSeconds += coveredSeconds;
    } else unknownChecks += 1;
  }

  const totalChecks = checks.length;
  const coveredSeconds = Math.min(
    elapsedSeconds || (totalChecks ? intervalSeconds : 0),
    estimatedObservedSeconds,
  );
  const coveragePercentage = expectedChecks
    ? Math.min(100, (scheduledChecks / expectedChecks) * 100)
    : 0;
  const uptimePercentage = totalChecks
    ? Number(((successfulChecks / totalChecks) * 100).toFixed(2))
    : null;

  return {
    totalChecks,
    scheduledChecks,
    successfulChecks,
    failedChecks,
    degradedChecks,
    unknownChecks,
    expectedChecks,
    coveragePercentage: Number(coveragePercentage.toFixed(2)),
    unobservedSeconds: Math.max(0, Math.round(elapsedSeconds - coveredSeconds)),
    uptimePercentage,
    avgResponseTime: totalChecks
      ? Number((responseTimeSum / totalChecks).toFixed(2))
      : 0,
    minResponseTime: totalChecks ? minResponseTime : 0,
    maxResponseTime,
    _responseTimeSum: responseTimeSum,
    estimatedDowntimeSeconds: Math.min(
      Math.round(elapsedSeconds),
      Math.round(estimatedDowntimeSeconds),
    ),
    estimatedDegradedSeconds: Math.min(
      Math.round(elapsedSeconds),
      Math.round(estimatedDegradedSeconds),
    ),
    // Kept for existing charts and clients. Its value is an estimate; the
    // explicit field makes that meaning available to new consumers.
    downtimeSeconds: Math.min(
      Math.round(elapsedSeconds),
      Math.round(estimatedDowntimeSeconds),
    ),
    degradedSeconds: Math.min(
      Math.round(elapsedSeconds),
      Math.round(estimatedDegradedSeconds),
    ),
    lastCheckAt,
  };
};

const fetchDayChecks = (model, monitorId, date) => {
  const start = startOfDayUTC(date);
  const end = new Date(start.getTime() + DAY_MS);
  return model
    .find({ monitor: monitorId, checkedAt: { $gte: start, $lt: end } })
    .select("status responseTime intervalSeconds scheduled checkedAt")
    .sort({ checkedAt: 1 })
    .lean();
};

/** Rebuild one UTC daily bucket from canonical health-check history. */
export const reconcileDailyStat = async (monitor, date, deps = {}) => {
  const dailyStats = deps.DailyStat || DailyStat;
  const checksModel = deps.HealthCheck || HealthCheck;
  const bucketDate = startOfDayUTC(date);
  const checks = await fetchDayChecks(checksModel, monitor._id, bucketDate);
  if (!checks.length) {
    await dailyStats.deleteOne({ monitor: monitor._id, date: bucketDate });
    return null;
  }
  const summary = summarizeChecks(checks, monitor, bucketDate);
  return dailyStats.findOneAndUpdate(
    { monitor: monitor._id, date: bucketDate },
    { $set: { monitor: monitor._id, date: bucketDate, ...summary } },
    { upsert: true, returnDocument: "after" },
  );
};

/** The scheduled pipeline updates only the affected UTC day, idempotently. */
export const updateDailyStat = (monitor, healthCheck, deps = {}) =>
  reconcileDailyStat(monitor, healthCheck.checkedAt || new Date(), deps);

/**
 * Rebuild a bounded historical range after health-check edits/deletions.
 * This is intentionally an explicit maintenance operation, never run from a
 * dashboard request. Empty days remove stale buckets left by deleted checks.
 */
export const reconcileDailyStatsForRange = async (
  monitor,
  start,
  end,
  deps = {},
) => {
  const dailyStats = deps.DailyStat || DailyStat;
  const checksModel = deps.HealthCheck || HealthCheck;
  const firstDay = startOfDayUTC(start);
  const lastDay = startOfDayUTC(end);
  const checks = await checksModel
    .find({
      monitor: monitor._id,
      checkedAt: { $gte: firstDay, $lt: new Date(lastDay.getTime() + DAY_MS) },
    })
    .select("status responseTime intervalSeconds scheduled checkedAt")
    .sort({ checkedAt: 1 })
    .lean();
  const byDay = new Map();
  for (const check of checks) {
    const key = startOfDayUTC(check.checkedAt).toISOString();
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(check);
  }

  const results = [];
  for (
    let day = firstDay;
    day <= lastDay;
    day = new Date(day.getTime() + DAY_MS)
  ) {
    const checksForDay = byDay.get(day.toISOString()) || [];
    if (!checksForDay.length) {
      await dailyStats.deleteOne({ monitor: monitor._id, date: day });
      continue;
    }
    const summary = summarizeChecks(checksForDay, monitor, day);
    results.push(
      await dailyStats.findOneAndUpdate(
        { monitor: monitor._id, date: day },
        { $set: { monitor: monitor._id, date: day, ...summary } },
        { upsert: true, returnDocument: "after" },
      ),
    );
  }
  return results;
};
