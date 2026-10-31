import mongoose from "mongoose";
import DailyStat from "../models/DailyStat.js";
import HourlyStat from "../models/HourlyStat.js";
import Monitor from "../models/Monitor.js";
import HealthCheck from "../models/HealthCheck.js";
import { startOfDayUTC } from "../utils/dateUtils.js";
import { HEALTH_STATUS } from "../config/constants.js";
import {
  buildLatencyHistograms,
  LATENCY_HISTOGRAM_VERSION,
  LATENCY_METRICS,
} from "../utils/latencyHistogram.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const hourlyStatsBackfilledMonitorIds = new Set();

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
    latencyHistograms: buildLatencyHistograms(checks),
  };
};

const fetchDayChecks = (model, monitorId, date) => {
  const start = startOfDayUTC(date);
  const end = new Date(start.getTime() + DAY_MS);
  return model
    .find({ monitor: monitorId, checkedAt: { $gte: start, $lt: end } })
    .select(
      "status responseTime timings diagnostics httpStatus intervalSeconds scheduled checkedAt",
    )
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
    if (dailyStats.deleteOne) {
      await dailyStats.deleteOne({ monitor: monitor._id, date: bucketDate });
    }
    return null;
  }
  const existing = dailyStats.findOne
    ? await dailyStats.findOne({
        monitor: monitor._id,
        date: bucketDate,
      })
    : null;
  if (existing?.totalChecks > checks.length) return existing;
  const summary = summarizeChecks(checks, monitor, bucketDate);
  return dailyStats.findOneAndUpdate(
    { monitor: monitor._id, date: bucketDate },
    { $set: { monitor: monitor._id, date: bucketDate, ...summary } },
    { upsert: true, returnDocument: "after" },
  );
};

const startOfHourUTC = (value) => {
  const hour = new Date(value);
  hour.setUTCMinutes(0, 0, 0);
  return hour;
};

export const backfillRecentHourlyStats = async (
  monitorId,
  intervalSeconds,
  deps = {},
) => {
  if (hourlyStatsBackfilledMonitorIds.has(String(monitorId))) return false;
  const monitorModel = deps.Monitor || Monitor;
  const checksModel = deps.HealthCheck || HealthCheck;
  const hourlyStats = deps.HourlyStat || HourlyStat;
  if (mongoose.Types.ObjectId.isValid(monitorId)) {
    const marker = await monitorModel
      .findById(monitorId)
      .select("+hourlyStatsBackfilledAt")
      .lean();
    if (marker?.hourlyStatsBackfilledAt) {
      hourlyStatsBackfilledMonitorIds.add(String(monitorId));
      return false;
    }
  } else {
    return false;
  }

  const since = new Date(Date.now() - 7 * DAY_MS);
  const rows = await checksModel.aggregate([
    { $match: { monitor: monitorId, checkedAt: { $gte: since } } },
    {
      $group: {
        _id: {
          $dateToString: {
            format: "%Y-%m-%dT%H:00:00.000Z",
            date: "$checkedAt",
          },
        },
        totalChecks: { $sum: 1 },
        scheduledChecks: {
          $sum: { $cond: [{ $ne: ["$scheduled", false] }, 1, 0] },
        },
        successfulChecks: {
          $sum: { $cond: [{ $eq: ["$status", HEALTH_STATUS.UP] }, 1, 0] },
        },
        failedChecks: {
          $sum: { $cond: [{ $eq: ["$status", HEALTH_STATUS.DOWN] }, 1, 0] },
        },
        degradedChecks: {
          $sum: { $cond: [{ $eq: ["$status", HEALTH_STATUS.DEGRADED] }, 1, 0] },
        },
        unknownChecks: {
          $sum: { $cond: [{ $eq: ["$status", HEALTH_STATUS.UNKNOWN] }, 1, 0] },
        },
        frontendUpChecks: {
          $sum: {
            $cond: [{ $eq: ["$frontendStatus", HEALTH_STATUS.UP] }, 1, 0],
          },
        },
        backendUpChecks: {
          $sum: {
            $cond: [{ $eq: ["$backendStatus", HEALTH_STATUS.UP] }, 1, 0],
          },
        },
        databaseUpChecks: {
          $sum: {
            $cond: [{ $eq: ["$databaseStatus", HEALTH_STATUS.UP] }, 1, 0],
          },
        },
        _responseTimeSum: { $sum: "$responseTime" },
        minResponseTime: { $min: "$responseTime" },
        maxResponseTime: { $max: "$responseTime" },
        _observedSeconds: {
          $sum: {
            $cond: [
              { $ne: ["$scheduled", false] },
              { $ifNull: ["$intervalSeconds", 300] },
              0,
            ],
          },
        },
        estimatedDowntimeSeconds: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$status", HEALTH_STATUS.DOWN] },
                  { $ne: ["$scheduled", false] },
                ],
              },
              { $ifNull: ["$intervalSeconds", 300] },
              0,
            ],
          },
        },
        estimatedDegradedSeconds: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$status", HEALTH_STATUS.DEGRADED] },
                  { $ne: ["$scheduled", false] },
                ],
              },
              { $ifNull: ["$intervalSeconds", 300] },
              0,
            ],
          },
        },
        lastCheckAt: { $max: "$checkedAt" },
        latencySamples: {
          $push: {
            httpStatus: "$httpStatus",
            responseTime: "$responseTime",
            timings: "$timings",
            diagnostics: "$diagnostics",
          },
        },
      },
    },
  ]);
  const now = new Date();
  if (rows.length) {
    await hourlyStats.bulkWrite(
      rows.map((row) => {
        const { _id: bucketKey, latencySamples = [], ...bucket } = row;
        const date = new Date(bucketKey);
        const elapsed = Math.min(
          3600,
          Math.max(
            0,
            (Math.min(now.getTime(), date.getTime() + 3600000) -
              date.getTime()) /
              1000,
          ),
        );
        const observed = Math.min(elapsed, row._observedSeconds || 0);
        const expected = Math.max(
          1,
          Math.ceil(elapsed / Math.max(1, intervalSeconds || 300)),
        );
        return {
          updateOne: {
            filter: { monitor: monitorId, date },
            update: {
              $set: {
                ...bucket,
                monitor: monitorId,
                date,
                uptimePercentage: row.totalChecks
                  ? (row.successfulChecks / row.totalChecks) * 100
                  : null,
                avgResponseTime: row.totalChecks
                  ? row._responseTimeSum / row.totalChecks
                  : 0,
                expectedChecks: expected,
                coveragePercentage: Math.min(
                  100,
                  (row.scheduledChecks / expected) * 100,
                ),
                unobservedSeconds: Math.max(0, elapsed - observed),
                downtimeSeconds: row.estimatedDowntimeSeconds,
                degradedSeconds: row.estimatedDegradedSeconds,
                responseTimeBuckets: {},
                latencyHistograms: buildLatencyHistograms(latencySamples),
              },
            },
            upsert: true,
          },
        };
      }),
      { ordered: false },
    );
  }
  await monitorModel.updateOne(
    { _id: monitorId },
    { $set: { hourlyStatsBackfilledAt: now } },
  );
  hourlyStatsBackfilledMonitorIds.add(String(monitorId));
  return true;
};

const incrementStatBucket = async (
  model,
  monitor,
  healthCheck,
  bucketStart,
  bucketSeconds,
) => {
  const checkedAt = new Date(healthCheck.checkedAt || new Date());
  const elapsedSeconds = Math.min(
    bucketSeconds,
    Math.max(0, (checkedAt.getTime() - bucketStart.getTime()) / 1000),
  );
  const interval = Math.max(
    1,
    Number(healthCheck.intervalSeconds) || Number(monitor.interval) || 300,
  );
  const scheduled = healthCheck.scheduled !== false;
  const status = healthCheck.status;
  const responseTime = Math.max(0, Number(healthCheck.responseTime) || 0);
  const success = status === HEALTH_STATUS.UP ? 1 : 0;
  const failed = status === HEALTH_STATUS.DOWN ? 1 : 0;
  const degraded = status === HEALTH_STATUS.DEGRADED ? 1 : 0;
  const unknown = status === HEALTH_STATUS.UNKNOWN ? 1 : 0;
  const frontendUp = healthCheck.frontendStatus === HEALTH_STATUS.UP ? 1 : 0;
  const backendUp = healthCheck.backendStatus === HEALTH_STATUS.UP ? 1 : 0;
  const databaseUp = healthCheck.databaseStatus === HEALTH_STATUS.UP ? 1 : 0;
  const responseBucket =
    responseTime < 50
      ? "lt50"
      : responseTime < 100
        ? "lt100"
        : responseTime < 250
          ? "lt250"
          : responseTime < 500
            ? "lt500"
            : responseTime < 1000
              ? "lt1000"
              : responseTime < 2500
                ? "lt2500"
                : responseTime < 5000
                  ? "lt5000"
                  : "gte5000";
  const expectedChecks = elapsedSeconds
    ? Math.max(1, Math.ceil(elapsedSeconds / interval))
    : 0;
  const oldTotal = { $ifNull: ["$totalChecks", 0] };
  const nextTotal = {
    $add: [oldTotal, { $cond: ["$_addIncomingCheck", 1, 0] }],
  };
  const oldScheduled = { $ifNull: ["$scheduledChecks", 0] };
  const nextScheduled = {
    $add: [
      oldScheduled,
      { $cond: ["$_addIncomingCheck", scheduled ? 1 : 0, 0] },
    ],
  };
  const observedSeconds = {
    $add: [
      {
        $ifNull: ["$_observedSeconds", { $multiply: [oldScheduled, interval] }],
      },
      { $cond: ["$_addIncomingCheck", scheduled ? interval : 0, 0] },
    ],
  };
  const responseSum = {
    $add: [
      { $ifNull: ["$_responseTimeSum", 0] },
      { $cond: ["$_addIncomingCheck", responseTime, 0] },
    ],
  };
  const oldSuccessful = { $ifNull: ["$successfulChecks", 0] };
  const nextSuccessful = {
    $add: [oldSuccessful, { $cond: ["$_addIncomingCheck", success, 0] }],
  };
  const downSeconds = {
    $cond: ["$_addIncomingCheck", failed && scheduled ? interval : 0, 0],
  };
  const degradedSeconds = {
    $cond: ["$_addIncomingCheck", degraded && scheduled ? interval : 0, 0],
  };
  const incomingHistograms = buildLatencyHistograms([healthCheck]);
  const latencyMetrics = {};
  for (const metric of LATENCY_METRICS) {
    const sample = incomingHistograms[metric];
    const bucket = Object.keys(sample.buckets)[0];
    const currentPath = `$latencyHistograms.${metric}`;
    latencyMetrics[metric] = {
      $mergeObjects: [
        { $ifNull: [currentPath, {}] },
        {
          sampleCount: {
            $add: [
              { $ifNull: [`${currentPath}.sampleCount`, 0] },
              {
                $cond: [
                  {
                    $and: [
                      "$_addIncomingCheck",
                      sample.sampleCount ? true : false,
                    ],
                  },
                  1,
                  0,
                ],
              },
            ],
          },
          ...(bucket
            ? {
                buckets: {
                  $mergeObjects: [
                    { $ifNull: [`${currentPath}.buckets`, {}] },
                    {
                      [bucket]: {
                        $add: [
                          { $ifNull: [`${currentPath}.buckets.${bucket}`, 0] },
                          { $cond: ["$_addIncomingCheck", 1, 0] },
                        ],
                      },
                    },
                  ],
                },
              }
            : {}),
        },
      ],
    };
  }

  await model.updateOne(
    { monitor: monitor._id, date: bucketStart },
    [
      {
        $set: {
          _addIncomingCheck: {
            $gt: [checkedAt, { $ifNull: ["$lastCheckAt", new Date(0)] }],
          },
        },
      },
      {
        $set: {
          monitor: { $ifNull: ["$monitor", monitor._id] },
          date: { $ifNull: ["$date", bucketStart] },
          totalChecks: nextTotal,
          scheduledChecks: nextScheduled,
          successfulChecks: nextSuccessful,
          failedChecks: {
            $add: [
              { $ifNull: ["$failedChecks", 0] },
              { $cond: ["$_addIncomingCheck", failed, 0] },
            ],
          },
          degradedChecks: {
            $add: [
              { $ifNull: ["$degradedChecks", 0] },
              { $cond: ["$_addIncomingCheck", degraded, 0] },
            ],
          },
          unknownChecks: {
            $add: [
              { $ifNull: ["$unknownChecks", 0] },
              { $cond: ["$_addIncomingCheck", unknown, 0] },
            ],
          },
          frontendUpChecks: {
            $add: [
              { $ifNull: ["$frontendUpChecks", 0] },
              { $cond: ["$_addIncomingCheck", frontendUp, 0] },
            ],
          },
          backendUpChecks: {
            $add: [
              { $ifNull: ["$backendUpChecks", 0] },
              { $cond: ["$_addIncomingCheck", backendUp, 0] },
            ],
          },
          databaseUpChecks: {
            $add: [
              { $ifNull: ["$databaseUpChecks", 0] },
              { $cond: ["$_addIncomingCheck", databaseUp, 0] },
            ],
          },
          _responseTimeSum: responseSum,
          latencyHistograms: {
            $mergeObjects: [
              { $ifNull: ["$latencyHistograms", {}] },
              { version: LATENCY_HISTOGRAM_VERSION, ...latencyMetrics },
            ],
          },
          _observedSeconds: observedSeconds,
          responseTimeBuckets: {
            $mergeObjects: [
              { $ifNull: ["$responseTimeBuckets", {}] },
              {
                [responseBucket]: {
                  $add: [
                    { $ifNull: [`$responseTimeBuckets.${responseBucket}`, 0] },
                    { $cond: ["$_addIncomingCheck", 1, 0] },
                  ],
                },
              },
            ],
          },
          avgResponseTime: { $divide: [responseSum, nextTotal] },
          minResponseTime: {
            $cond: [
              "$_addIncomingCheck",
              {
                $cond: [
                  { $eq: [oldTotal, 0] },
                  responseTime,
                  {
                    $min: [
                      { $ifNull: ["$minResponseTime", responseTime] },
                      responseTime,
                    ],
                  },
                ],
              },
              { $ifNull: ["$minResponseTime", responseTime] },
            ],
          },
          maxResponseTime: {
            $cond: [
              "$_addIncomingCheck",
              {
                $max: [
                  { $ifNull: ["$maxResponseTime", responseTime] },
                  responseTime,
                ],
              },
              { $ifNull: ["$maxResponseTime", responseTime] },
            ],
          },
          uptimePercentage: {
            $multiply: [{ $divide: [nextSuccessful, nextTotal] }, 100],
          },
          expectedChecks,
          coveragePercentage: expectedChecks
            ? {
                $min: [
                  100,
                  {
                    $multiply: [
                      { $divide: [nextScheduled, expectedChecks] },
                      100,
                    ],
                  },
                ],
              }
            : 0,
          unobservedSeconds: {
            $max: [
              0,
              {
                $subtract: [
                  elapsedSeconds,
                  { $min: [elapsedSeconds, observedSeconds] },
                ],
              },
            ],
          },
          estimatedDowntimeSeconds: {
            $min: [
              bucketSeconds,
              {
                $add: [
                  { $ifNull: ["$estimatedDowntimeSeconds", 0] },
                  downSeconds,
                ],
              },
            ],
          },
          downtimeSeconds: {
            $min: [
              bucketSeconds,
              { $add: [{ $ifNull: ["$downtimeSeconds", 0] }, downSeconds] },
            ],
          },
          estimatedDegradedSeconds: {
            $min: [
              bucketSeconds,
              {
                $add: [
                  { $ifNull: ["$estimatedDegradedSeconds", 0] },
                  degradedSeconds,
                ],
              },
            ],
          },
          degradedSeconds: {
            $min: [
              bucketSeconds,
              { $add: [{ $ifNull: ["$degradedSeconds", 0] }, degradedSeconds] },
            ],
          },
          lastCheckAt: {
            $max: [{ $ifNull: ["$lastCheckAt", checkedAt] }, checkedAt],
          },
        },
      },
      { $unset: "_addIncomingCheck" },
    ],
    { upsert: true, updatePipeline: true },
  );
};

/** Store compact per-day and per-hour aggregates for every persisted check. */
export const updateDailyStat = async (monitor, healthCheck, deps = {}) => {
  const dailyStats = deps.DailyStat || DailyStat;
  if (!dailyStats.updateOne && dailyStats.findOneAndUpdate) {
    return reconcileDailyStat(
      monitor,
      healthCheck.checkedAt || new Date(),
      deps,
    );
  }
  const hourlyStats = deps.HourlyStat || HourlyStat;
  const checkedAt = healthCheck.checkedAt || new Date();
  const hourlyBackfilled = await backfillRecentHourlyStats(
    monitor._id,
    monitor.interval,
    deps,
  );
  await Promise.all([
    incrementStatBucket(
      dailyStats,
      monitor,
      healthCheck,
      startOfDayUTC(checkedAt),
      DAY_MS / 1000,
    ),
    ...(hourlyBackfilled
      ? []
      : [
          incrementStatBucket(
            hourlyStats,
            monitor,
            healthCheck,
            startOfHourUTC(checkedAt),
            60 * 60,
          ),
        ]),
  ]);
};

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
    .select(
      "status responseTime timings diagnostics httpStatus intervalSeconds scheduled checkedAt",
    )
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
      continue;
    }
    const existing = dailyStats.findOne
      ? await dailyStats.findOne({
          monitor: monitor._id,
          date: day,
        })
      : null;
    if (existing?.totalChecks > checksForDay.length) {
      results.push(existing);
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
