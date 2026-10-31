import mongoose from "mongoose";
import Monitor from "../models/Monitor.js";
import HealthCheck from "../models/HealthCheck.js";
import Incident from "../models/Incident.js";
import DailyStat from "../models/DailyStat.js";
import HourlyStat from "../models/HourlyStat.js";
import ApiError from "../utils/ApiError.js";
import {
  WINDOW_MS,
  WINDOW_KEYS,
  HEALTH_STATUS,
  INCIDENT_STATUS,
  MONITOR_POPULATE_FIELDS,
  TRIGGER_CHECK_POPULATE_FIELDS,
} from "../config/constants.js";
import {
  startOfDayUTC,
  endOfDayUTC,
  msBefore,
  isStale,
  daysBetween,
} from "../utils/dateUtils.js";
import { getOwnedMonitorIds } from "./monitor.service.js";
import { getPlanDefinition } from "../config/plans.js";
import { FEATURES, hasFeature } from "../config/features.js";
import { estimatePercentile } from "../utils/latencyHistogram.js";
import PerformanceAlertState from "../models/PerformanceAlertState.js";

const resolveOwnerObjectId = (user) =>
  new mongoose.Types.ObjectId(user.id || user._id);

/**
 * Narrows a monitor-id filter to the caller's owned monitors, optionally
 * intersected with a single requested monitor ID. If the requested ID
 * isn't one of the caller's own, the filter resolves to an impossible
 * match ($in: []) rather than throwing — list endpoints degrade to an
 * empty result instead of leaking whether the ID exists for someone else.
 */
const resolveMonitorFilter = (ownedIds, monitorId) => {
  if (!monitorId) return { $in: ownedIds };
  const requested = new mongoose.Types.ObjectId(monitorId);
  return ownedIds.some((id) => id.equals(requested)) ? requested : { $in: [] };
};

// ── Overview ─────────────────────────────────────────────────────────────────

export const getOverview = async (user) => {
  const since = msBefore(WINDOW_MS["24h"]);
  const ownedIds = await getOwnedMonitorIds(user);
  const ownerId = resolveOwnerObjectId(user);

  const [
    monitorCounts,
    latestPerMonitor,
    systemStats,
    activeIncidentCount,
    latestIncidents,
    recentChecks,
    coverageMonitors,
  ] = await Promise.all([
    // 1 ─ Monitor counts, scoped to the caller
    Monitor.aggregate([
      { $match: { owner: ownerId } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: { $sum: { $cond: ["$active", 1, 0] } },
          inactive: { $sum: { $cond: ["$active", 0, 1] } },
        },
      },
    ]),

    // 2 ─ Latest health check per active monitor owned by the caller
    HealthCheck.aggregate([
      { $match: { monitor: { $in: ownedIds } } },
      { $sort: { monitor: 1, checkedAt: -1 } },
      {
        $group: {
          _id: "$monitor",
          status: { $first: "$status" },
          responseTime: { $first: "$responseTime" },
          checkedAt: { $first: "$checkedAt" },
        },
      },
      {
        $lookup: {
          from: "monitors",
          localField: "_id",
          foreignField: "_id",
          as: "_monitor",
          pipeline: [
            { $match: { active: true } },
            { $project: { _id: 1, name: 1, interval: 1 } },
          ],
        },
      },
      { $match: { "_monitor.0": { $exists: true } } },
      {
        $addFields: {
          interval: { $arrayElemAt: ["$_monitor.interval", 0] },
        },
      },
      { $project: { _monitor: 0 } },
    ]),

    // 3 ─ Uptime + avg response time (last 24 h), scoped to the caller
    HourlyStat.aggregate([
      {
        $match: {
          monitor: { $in: ownedIds },
          date: { $gte: new Date(new Date(since).setUTCMinutes(0, 0, 0)) },
        },
      },
      {
        $group: {
          _id: null,
          totalChecks: { $sum: "$totalChecks" },
          scheduledChecks: { $sum: "$scheduledChecks" },
          successfulChecks: { $sum: "$successfulChecks" },
          weightedResponseTime: {
            $sum: {
              $ifNull: [
                "$_responseTimeSum",
                { $multiply: ["$avgResponseTime", "$totalChecks"] },
              ],
            },
          },
        },
      },
    ]),

    // 4 ─ Active incident count, scoped to the caller
    Incident.countDocuments({
      status: { $ne: INCIDENT_STATUS.RESOLVED },
      monitor: { $in: ownedIds },
    }),

    // 5 ─ Latest active incidents (preview — top 5), scoped to the caller
    Incident.find({
      status: { $ne: INCIDENT_STATUS.RESOLVED },
      monitor: { $in: ownedIds },
    })
      .populate("monitor", MONITOR_POPULATE_FIELDS)
      .sort({ startedAt: -1 })
      .limit(5)
      .lean(),

    // 6 ─ Most recent health checks (last 10), scoped to the caller
    HealthCheck.find({ monitor: { $in: ownedIds } })
      .populate("monitor", MONITOR_POPULATE_FIELDS)
      .select("-rawResponse -__v")
      .sort({ checkedAt: -1 })
      .limit(10)
      .lean(),

    Monitor.find({ owner: ownerId, active: true })
      .select("interval createdAt")
      .lean(),
  ]);

  // ── Format response ──

  const counts = monitorCounts[0] || { total: 0, active: 0, inactive: 0 };

  const currentStatus = {
    [HEALTH_STATUS.UP]: 0,
    [HEALTH_STATUS.DOWN]: 0,
    [HEALTH_STATUS.DEGRADED]: 0,
    [HEALTH_STATUS.UNKNOWN]: 0,
  };

  for (const doc of latestPerMonitor) {
    if (isStale(doc.checkedAt, doc.interval || 300)) {
      currentStatus[HEALTH_STATUS.UNKNOWN]++;
    } else if (doc.status in currentStatus) {
      currentStatus[doc.status]++;
    } else {
      currentStatus[HEALTH_STATUS.UNKNOWN]++;
    }
  }

  const neverChecked = Math.max(0, counts.active - latestPerMonitor.length);
  currentStatus[HEALTH_STATUS.UNKNOWN] += neverChecked;

  const stats = systemStats[0] || {
    totalChecks: 0,
    scheduledChecks: 0,
    successfulChecks: 0,
    avgResponseTime: 0,
  };
  stats.avgResponseTime = stats.totalChecks
    ? stats.weightedResponseTime / stats.totalChecks
    : 0;

  const uptimePercentage =
    stats.totalChecks > 0
      ? parseFloat(
          ((stats.successfulChecks / stats.totalChecks) * 100).toFixed(2),
        )
      : null;
  const now = new Date();
  const expectedChecks = coverageMonitors.reduce((sum, monitor) => {
    const startedAt = Math.max(
      since.getTime(),
      new Date(monitor.createdAt || since).getTime(),
    );
    const seconds = Math.max(0, (now.getTime() - startedAt) / 1000);
    return (
      sum +
      (seconds > 0
        ? Math.max(1, Math.ceil(seconds / (monitor.interval || 300)))
        : 0)
    );
  }, 0);

  return {
    monitors: {
      total: counts.total,
      active: counts.active,
      inactive: counts.inactive,
    },
    currentStatus,
    uptime: {
      percentage: uptimePercentage,
      window: "24h",
      totalChecks: stats.totalChecks,
      expectedChecks,
      coveragePercentage: expectedChecks
        ? Number(
            Math.min(
              100,
              (stats.scheduledChecks / expectedChecks) * 100,
            ).toFixed(2),
          )
        : 0,
      basis: "observed_checks",
    },
    responseTime: {
      average: parseFloat((stats.avgResponseTime || 0).toFixed(2)),
      window: "24h",
    },
    activeIncidents: {
      count: activeIncidentCount,
      latest: latestIncidents,
    },
    recentChecks,
  };
};

// ── Active incidents (paginated) ─────────────────────────────────────────────

export const getActiveIncidents = async ({ page, limit, severity }, user) => {
  const ownedIds = await getOwnedMonitorIds(user);

  const filter = {
    status: { $ne: INCIDENT_STATUS.RESOLVED },
    monitor: { $in: ownedIds },
  };
  if (severity) filter.severity = severity;

  const skip = (page - 1) * limit;

  const [incidents, total] = await Promise.all([
    Incident.find(filter)
      .populate("monitor", MONITOR_POPULATE_FIELDS)
      .populate("triggerCheck", TRIGGER_CHECK_POPULATE_FIELDS)
      .sort({ startedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Incident.countDocuments(filter),
  ]);

  return {
    incidents,
    total,
    page,
    totalPages: Math.ceil(total / limit) || 1,
  };
};

// ── Recent health checks ──────────────────────────────────────────────────────

export const getRecentHealthChecks = async (
  { monitorId, status, limit },
  user,
) => {
  const ownedIds = await getOwnedMonitorIds(user);

  const filter = { monitor: resolveMonitorFilter(ownedIds, monitorId) };
  if (status) {
    filter.status = status;
  }

  return HealthCheck.find(filter)
    .populate("monitor", MONITOR_POPULATE_FIELDS)
    .select("-rawResponse -__v")
    .sort({ checkedAt: -1 })
    .limit(limit)
    .lean();
};

// ── Per-monitor stats ─────────────────────────────────────────────────────────

export const getMonitorStats = async (monitorId, { window }, user) => {
  const ownerId = user.id || user._id.toString();
  const id = new mongoose.Types.ObjectId(monitorId);

  const monitor = await Monitor.findOne({ _id: id, owner: ownerId })
    .select(
      "name url active interval lastCheckedAt nextCheckAt consecutiveFailures createdAt updatedAt",
    )
    .lean();
  if (!monitor) {
    throw ApiError.notFound(`Monitor not found with id: ${monitorId}`);
  }

  const windowMs = WINDOW_MS[window];
  const endDate = new Date();
  const since = new Date(endDate.getTime() - windowMs);
  const periodStart = new Date(
    Math.max(since.getTime(), new Date(monitor.createdAt).getTime()),
  );
  const elapsedSeconds = Math.max(0, (endDate - periodStart) / 1000);
  const isHourlyWindow = window === "24h";
  const statModel = isHourlyWindow ? HourlyStat : DailyStat;
  const bucketStart = isHourlyWindow
    ? new Date(new Date(since).setUTCMinutes(0, 0, 0))
    : startOfDayUTC(since);
  const [result] = await statModel.aggregate([
    {
      $match: {
        monitor: id,
        date: {
          $gte: bucketStart,
          $lte: isHourlyWindow
            ? new Date(new Date(endDate).setUTCMinutes(0, 0, 0))
            : startOfDayUTC(endDate),
        },
      },
    },
    {
      $group: {
        _id: null,
        totalChecks: { $sum: "$totalChecks" },
        scheduledChecks: { $sum: "$scheduledChecks" },
        successfulChecks: { $sum: "$successfulChecks" },
        failedChecks: { $sum: "$failedChecks" },
        degradedChecks: { $sum: "$degradedChecks" },
        unknownChecks: { $sum: "$unknownChecks" },
        observedSeconds: {
          $sum: {
            $ifNull: [
              "$_observedSeconds",
              { $multiply: ["$scheduledChecks", monitor.interval || 300] },
            ],
          },
        },
        average: {
          $sum: {
            $ifNull: [
              "$_responseTimeSum",
              { $multiply: ["$avgResponseTime", "$totalChecks"] },
            ],
          },
        },
        min: { $min: "$minResponseTime" },
        max: { $max: "$maxResponseTime" },
        estimatedDownSeconds: { $sum: "$estimatedDowntimeSeconds" },
        estimatedDegradedSeconds: { $sum: "$estimatedDegradedSeconds" },
      },
    },
  ]);
  const totalChecks = result?.totalChecks || 0;
  const expectedChecks =
    elapsedSeconds > 0
      ? Math.max(1, Math.ceil(elapsedSeconds / (monitor.interval || 300)))
      : 0;
  const uptimePercentage = totalChecks
    ? Number(((result.successfulChecks / totalChecks) * 100).toFixed(2))
    : null;
  const responseTimeStats = {
    average: Number(
      ((result?.average || 0) / (result?.totalChecks || 1)).toFixed(2),
    ),
    min: result?.min || 0,
    max: result?.max || 0,
  };
  const elapsedCoverageSeconds = Math.max(0, Math.round(elapsedSeconds));

  const [latestCheck, recentChecks, activeIncident] = await Promise.all([
    HealthCheck.findLatest(id),
    HealthCheck.find({ monitor: id })
      .select("-rawResponse -__v")
      .sort({ checkedAt: -1 })
      .limit(10)
      .lean(),
    Incident.findActiveForMonitor(id)
      .populate("triggerCheck", TRIGGER_CHECK_POPULATE_FIELDS)
      .lean(),
  ]);

  let currentStatus = latestCheck?.status || HEALTH_STATUS.UNKNOWN;
  if (
    latestCheck &&
    monitor.interval &&
    isStale(latestCheck.checkedAt, monitor.interval)
  ) {
    currentStatus = HEALTH_STATUS.UNKNOWN;
  }

  return {
    monitor: {
      id: monitor._id,
      name: monitor.name,
      url: monitor.url,
      active: monitor.active,
      interval: monitor.interval,
      createdAt: monitor.createdAt,
      updatedAt: monitor.updatedAt,
    },
    currentStatus,
    lastCheckedAt: monitor.lastCheckedAt,
    nextCheckAt: monitor.nextCheckAt,
    consecutiveFailures: monitor.consecutiveFailures,
    uptime: {
      percentage: uptimePercentage,
      window,
      basis: "observed_checks",
      totalChecks,
      scheduledChecks: result?.scheduledChecks || 0,
      successfulChecks: result?.successfulChecks || 0,
      failedChecks: result?.failedChecks || 0,
      degradedChecks: result?.degradedChecks || 0,
      unknownChecks: result?.unknownChecks || 0,
      expectedChecks,
      coveragePercentage: expectedChecks
        ? Number(
            Math.min(
              100,
              ((result?.scheduledChecks || 0) / expectedChecks) * 100,
            ).toFixed(2),
          )
        : 0,
      unobservedSeconds: Math.max(
        0,
        elapsedCoverageSeconds -
          Math.min(
            elapsedCoverageSeconds,
            Math.round(result?.observedSeconds || 0),
          ),
      ),
      estimatedDowntimeSeconds: Math.min(
        Math.round(elapsedSeconds),
        Math.round(result?.estimatedDownSeconds || 0),
      ),
      estimatedDegradedSeconds: Math.min(
        Math.round(elapsedSeconds),
        Math.round(result?.estimatedDegradedSeconds || 0),
      ),
    },
    responseTime: {
      ...responseTimeStats,
      window,
    },
    activeIncident,
    recentChecks,
  };
};

// ── Shared: hourly health-check bucket aggregation ────────────────────────────
//
// Extracted so the raw per-hour aggregation pipeline is defined exactly
// once and reused by both getMonitorChartData's 24h branch and the
// analytics endpoint's hourly chart — the two call sites only differ in
// how they map the raw bucket fields into their own response shape, not
// in how the buckets are computed. `until` is optional (open-ended,
// matching the original 24h chart's "since now" semantics); the
// analytics endpoint always supplies it to bound an explicit custom
// range.
const aggregateHourlyHealthCheckBuckets = (monitorId, since, until = null) =>
  HourlyStat.aggregate([
    {
      $match: {
        monitor: monitorId,
        date: until
          ? {
              $gte: new Date(new Date(since).setUTCMinutes(0, 0, 0)),
              $lte: new Date(new Date(until).setUTCMinutes(0, 0, 0)),
            }
          : { $gte: new Date(new Date(since).setUTCMinutes(0, 0, 0)) },
      },
    },
    {
      $project: {
        _id: {
          $dateToString: { format: "%Y-%m-%dT%H:00:00.000Z", date: "$date" },
        },
        avgResponseTime: 1,
        minResponseTime: 1,
        maxResponseTime: 1,
        totalChecks: 1,
        successfulChecks: 1,
        failedChecks: 1,
        degradedChecks: 1,
        scheduledChecks: 1,
        unknownChecks: 1,
        latencyHistograms: 1,
      },
    },
    { $sort: { _id: 1 } },
  ]);

// ── Per-monitor chart data ────────────────────────────────────────────────────

export const getMonitorChartData = async (monitorId, { window }, user) => {
  const ownerId = user.id || user._id.toString();
  const id = new mongoose.Types.ObjectId(monitorId);

  const monitor = await Monitor.findOne({ _id: id, owner: ownerId })
    .select("_id interval createdAt")
    .lean();
  if (!monitor) {
    throw ApiError.notFound(`Monitor not found with id: ${monitorId}`);
  }

  const windowMs = WINDOW_MS[window];
  const since = msBefore(windowMs);

  let dataPoints;

  if (window === "24h") {
    const buckets = await aggregateHourlyHealthCheckBuckets(id, since);
    const byHour = new Map(buckets.map((bucket) => [bucket._id, bucket]));
    dataPoints = [];
    const firstHour = new Date(since);
    firstHour.setUTCMinutes(0, 0, 0);
    const lastHour = new Date();
    lastHour.setUTCMinutes(0, 0, 0);
    const chartNow = new Date();
    for (
      let hour = firstHour;
      hour <= lastHour;
      hour = new Date(hour.getTime() + 60 * 60 * 1000)
    ) {
      const key = hour.toISOString().slice(0, 13) + ":00:00.000Z";
      const bucket = byHour.get(key);
      const eligibleStart = Math.max(
        hour.getTime(),
        since.getTime(),
        new Date(monitor.createdAt || since).getTime(),
      );
      const eligibleEnd = Math.min(
        hour.getTime() + 60 * 60 * 1000,
        chartNow.getTime(),
      );
      const eligibleSeconds = Math.max(0, (eligibleEnd - eligibleStart) / 1000);
      const expectedChecks =
        eligibleSeconds > 0
          ? Math.max(1, Math.ceil(eligibleSeconds / (monitor.interval || 300)))
          : 0;
      dataPoints.push({
        timestamp: key,
        avgResponseTime: parseFloat((bucket?.avgResponseTime || 0).toFixed(2)),
        minResponseTime: bucket?.minResponseTime || 0,
        maxResponseTime: bucket?.maxResponseTime || 0,
        totalChecks: bucket?.totalChecks || 0,
        successfulChecks: bucket?.successfulChecks || 0,
        failedChecks: bucket?.failedChecks || 0,
        degradedChecks: bucket?.degradedChecks || 0,
        unknownChecks: bucket?.unknownChecks || 0,
        expectedChecks,
        coveragePercentage: Number(
          Math.min(
            100,
            ((bucket?.scheduledChecks || 0) / expectedChecks) * 100,
          ).toFixed(2),
        ),
        uptimePercentage: bucket?.totalChecks
          ? Number(
              ((bucket.successfulChecks / bucket.totalChecks) * 100).toFixed(2),
            )
          : null,
      });
    }
  } else {
    const startDate = startOfDayUTC(since);
    const endDate = startOfDayUTC(new Date());

    const dailyStats = await DailyStat.getDateRangeStats(
      id,
      startDate,
      endDate,
    ).lean();
    const byDate = new Map(
      dailyStats.map((doc) => [new Date(doc.date).toISOString(), doc]),
    );
    dataPoints = [];
    for (
      let day = startDate;
      day <= endDate;
      day = new Date(day.getTime() + 24 * 60 * 60 * 1000)
    ) {
      const doc = byDate.get(day.toISOString());
      dataPoints.push({
        timestamp: day,
        avgResponseTime: doc?.avgResponseTime || 0,
        minResponseTime: doc?.minResponseTime || 0,
        maxResponseTime: doc?.maxResponseTime || 0,
        totalChecks: doc?.totalChecks || 0,
        successfulChecks: doc?.successfulChecks || 0,
        failedChecks: doc?.failedChecks || 0,
        degradedChecks: doc?.degradedChecks || 0,
        unknownChecks: doc?.unknownChecks || 0,
        expectedChecks: doc?.expectedChecks || 0,
        coveragePercentage: doc?.coveragePercentage || 0,
        uptimePercentage: doc?.totalChecks ? doc.uptimePercentage : null,
        downtimeSeconds: doc?.estimatedDowntimeSeconds || 0,
      });
    }
  }

  return {
    monitorId,
    window,
    dataPoints,
  };
};

// ── Per-monitor details (aggregated) ─────────────────────────────────────────

export const getMonitorDetails = async (monitorId, { window }, user) => {
  const canInspectResponses = hasFeature(
    user?.plan,
    FEATURES.RESPONSE_INSPECTION,
  );
  const [stats, chartData] = await Promise.all([
    getMonitorStats(monitorId, { window }, user),
    getMonitorChartData(monitorId, { window }, user),
  ]);
  const responseHistory = canInspectResponses
    ? await HealthCheck.find({ monitor: monitorId })
        .select("rawResponse checkedAt")
        .sort({ checkedAt: -1 })
        .limit(10)
        .lean()
    : [];

  const responseByCheckId = new Map(
    responseHistory.map((check) => [String(check._id), check.rawResponse]),
  );

  return {
    ...stats,
    ...(canInspectResponses && {
      recentChecks: stats.recentChecks.map((check) => ({
        ...check,
        rawResponse: responseByCheckId.get(String(check._id)) ?? null,
      })),
    }),
    chart: {
      window: chartData.window,
      dataPoints: chartData.dataPoints,
    },
  };
};

// ── Per-monitor analytics / performance insights (custom date range) ─────────

/**
 * Resolves the effective [startDate, endDate] window for the analytics
 * endpoint. A custom range always wins when supplied; otherwise falls
 * back to the requested (or default 30d) preset, mirroring
 * middlewares/featureAccess.js#requireAnalyticsRangeWithinRetention's
 * own default so the enforced limit and the actually-queried range can
 * never drift apart.
 */
const resolveAnalyticsRange = ({ window, startDate, endDate }) => {
  if (startDate && endDate) {
    return {
      startDate: startOfDayUTC(startDate),
      endDate: endOfDayUTC(endDate),
    };
  }

  const ms = WINDOW_MS[window || "30d"];
  return { startDate: msBefore(ms), endDate: new Date() };
};

/**
 * Overview KPIs for the analytics endpoint — uptime, response-time
 * distribution (avg/min/max/p95), and an approximate downtime/degraded
 * duration. Computed in a SINGLE aggregation ($group with a $facet-free
 * shape, since every metric shares the same $match) rather than several
 * round trips.
 *
 * p95ResponseTime uses MongoDB's native `$percentile` accumulator
 * (server-side, streaming — no per-document data has to be pulled into
 * application memory), which is the "analytics optimization" requirement
 * for a chart that can span a caller's entire retention window.
 *
 * downtimeSeconds/degradedSeconds are approximated as
 * `failedOrDegradedChecks * monitor.interval` — the same convention
 * workers/aggregationManager.js already uses for DailyStat, so this
 * endpoint's numbers stay consistent with the rest of the app rather than
 * introducing a second, differently-computed notion of "downtime".
 */
const computeOverviewStats = async (monitorId, monitor, startDate, endDate) => {
  const hourly = endDate.getTime() - startDate.getTime() <= 2 * 86400000;
  const statsModel = hourly ? HourlyStat : DailyStat;
  const [result] = await statsModel.aggregate([
    {
      $match: {
        monitor: monitorId,
        date: {
          $gte: hourly
            ? new Date(new Date(startDate).setUTCMinutes(0, 0, 0))
            : startOfDayUTC(startDate),
          $lte: hourly
            ? new Date(new Date(endDate).setUTCMinutes(0, 0, 0))
            : startOfDayUTC(endDate),
        },
      },
    },
    {
      $group: {
        _id: null,
        totalChecks: { $sum: "$totalChecks" },
        successfulChecks: { $sum: "$successfulChecks" },
        failedChecks: { $sum: "$failedChecks" },
        degradedChecks: { $sum: "$degradedChecks" },
        unknownChecks: { $sum: "$unknownChecks" },
        scheduledChecks: { $sum: "$scheduledChecks" },
        estimatedDownSeconds: { $sum: "$estimatedDowntimeSeconds" },
        estimatedDegradedSeconds: { $sum: "$estimatedDegradedSeconds" },
        observedSeconds: {
          $sum: {
            $ifNull: [
              "$_observedSeconds",
              { $multiply: ["$scheduledChecks", monitor.interval || 300] },
            ],
          },
        },
        responseTimeSum: {
          $sum: {
            $ifNull: [
              "$_responseTimeSum",
              { $multiply: ["$avgResponseTime", "$totalChecks"] },
            ],
          },
        },
        minResponseTime: { $min: "$minResponseTime" },
        maxResponseTime: { $max: "$maxResponseTime" },
        responseTimeBuckets: { $push: "$responseTimeBuckets" },
        latencyHistograms: { $push: "$latencyHistograms" },
      },
    },
  ]);

  if (!result || result.totalChecks === 0) {
    const eligibleStart = new Date(
      Math.max(
        startDate.getTime(),
        new Date(monitor.createdAt || startDate).getTime(),
      ),
    );
    const eligibleSeconds = Math.max(0, (endDate - eligibleStart) / 1000);
    const expectedChecks =
      eligibleSeconds > 0
        ? Math.max(1, Math.ceil(eligibleSeconds / (monitor.interval || 300)))
        : 0;
    return {
      totalChecks: 0,
      successfulChecks: 0,
      failedChecks: 0,
      degradedChecks: 0,
      uptimePercentage: null,
      unknownChecks: 0,
      scheduledChecks: 0,
      expectedChecks,
      coveragePercentage: 0,
      unobservedSeconds: Math.round(eligibleSeconds),
      basis: "observed_checks",
      avgResponseTime: 0,
      minResponseTime: 0,
      maxResponseTime: 0,
      p95ResponseTime: 0,
      p50ResponseTime: null,
      p99ResponseTime: null,
      responseTimeSampleCount: 0,
      latencyPercentiles: {
        estimate: "histogram_bucket_upper_bound",
        responseTime: { sampleCount: 0, p50: null, p95: null, p99: null },
        timings: Object.fromEntries(
          ["dns", "tcpConnect", "tlsHandshake", "ttfb"].map((metric) => [
            metric,
            { sampleCount: 0, p50: null, p95: null },
          ]),
        ),
      },
      downtimeSeconds: 0,
      estimatedDowntimeSeconds: 0,
      degradedSeconds: 0,
      estimatedDegradedSeconds: 0,
    };
  }

  const eligibleStart = new Date(
    Math.max(
      startDate.getTime(),
      new Date(monitor.createdAt || startDate).getTime(),
    ),
  );
  const eligibleSeconds = Math.max(0, (endDate - eligibleStart) / 1000);
  const expectedChecks =
    eligibleSeconds > 0
      ? Math.max(1, Math.ceil(eligibleSeconds / (monitor.interval || 300)))
      : 0;

  const responseBuckets = {};
  for (const doc of result.responseTimeBuckets || []) {
    for (const [key, count] of Object.entries(doc || {})) {
      responseBuckets[key] = (responseBuckets[key] || 0) + count;
    }
  }
  const p95Target = Math.ceil(result.totalChecks * 0.95);
  const bucketThresholds = [
    ["lt50", 50],
    ["lt100", 100],
    ["lt250", 250],
    ["lt500", 500],
    ["lt1000", 1000],
    ["lt2500", 2500],
    ["lt5000", 5000],
    ["gte5000", Math.max(5000, result.maxResponseTime || 5000)],
  ];
  let percentileCount = 0;
  let p95ResponseTime = result.maxResponseTime || 0;
  for (const [key, upperBound] of bucketThresholds) {
    percentileCount += responseBuckets[key] || 0;
    if (percentileCount >= p95Target) {
      p95ResponseTime = upperBound;
      break;
    }
  }

  const mergedHistograms = {};
  for (const document of result.latencyHistograms || []) {
    for (const [metric, histogram] of Object.entries(document || {})) {
      if (metric === "version" || !histogram) continue;
      const target = (mergedHistograms[metric] ||= {
        sampleCount: 0,
        buckets: {},
      });
      target.sampleCount += histogram.sampleCount || 0;
      for (const [bucket, count] of Object.entries(histogram.buckets || {}))
        target.buckets[bucket] = (target.buckets[bucket] || 0) + count;
    }
  }
  const responseDistribution = mergedHistograms.responseTime || {
    sampleCount: 0,
    buckets: {},
  };
  const percentile = (metric, p) =>
    estimatePercentile(mergedHistograms[metric], p);
  const p50ResponseTime = percentile("responseTime", 0.5);
  const p95Estimate = percentile("responseTime", 0.95);
  const p99ResponseTime = percentile("responseTime", 0.99);
  const timings = Object.fromEntries(
    ["dnsMs", "tcpConnectMs", "tlsHandshakeMs", "ttfbMs"].map((metric) => [
      metric.replace("Ms", ""),
      {
        sampleCount: mergedHistograms[metric]?.sampleCount || 0,
        p50: percentile(metric, 0.5),
        p95: percentile(metric, 0.95),
      },
    ]),
  );

  return {
    totalChecks: result.totalChecks,
    successfulChecks: result.successfulChecks,
    failedChecks: result.failedChecks,
    degradedChecks: result.degradedChecks,
    unknownChecks: result.unknownChecks,
    observedSeconds: result.observedSeconds,
    expectedChecks,
    scheduledChecks: result.scheduledChecks,
    coveragePercentage: expectedChecks
      ? Number(
          Math.min(
            100,
            (result.scheduledChecks / expectedChecks) * 100,
          ).toFixed(2),
        )
      : 0,
    unobservedSeconds: Math.max(
      0,
      Math.round(
        eligibleSeconds -
          Math.min(eligibleSeconds, result.observedSeconds || 0),
      ),
    ),
    basis: "observed_checks",
    uptimePercentage: parseFloat(
      ((result.successfulChecks / result.totalChecks) * 100).toFixed(2),
    ),
    avgResponseTime: parseFloat(
      ((result.responseTimeSum || 0) / result.totalChecks).toFixed(2),
    ),
    minResponseTime: result.minResponseTime || 0,
    maxResponseTime: result.maxResponseTime || 0,
    p95ResponseTime: Math.round(p95Estimate ?? p95ResponseTime),
    p50ResponseTime,
    p99ResponseTime,
    responseTimeSampleCount: responseDistribution.sampleCount,
    latencyPercentiles: {
      estimate: "histogram_bucket_upper_bound",
      responseTime: {
        sampleCount: responseDistribution.sampleCount,
        p50: p50ResponseTime,
        p95: p95Estimate,
        p99: p99ResponseTime,
      },
      timings,
    },
    downtimeSeconds: Math.min(
      Math.round(eligibleSeconds),
      Math.round(result.estimatedDownSeconds || 0),
    ),
    estimatedDowntimeSeconds: Math.min(
      Math.round(eligibleSeconds),
      Math.round(result.estimatedDownSeconds || 0),
    ),
    degradedSeconds: Math.min(
      Math.round(eligibleSeconds),
      Math.round(result.estimatedDegradedSeconds || 0),
    ),
    estimatedDegradedSeconds: Math.min(
      Math.round(eligibleSeconds),
      Math.round(result.estimatedDegradedSeconds || 0),
    ),
  };
};

/**
 * Component-level availability (frontend/backend/database) over the
 * requested range — surfaces the per-component health data
 * models/HealthCheck.js already records on every check but that no
 * existing endpoint aggregates into a summary percentage.
 */
const computeAvailabilityBreakdown = async (monitorId, startDate, endDate) => {
  const hourly = endDate.getTime() - startDate.getTime() <= 2 * 86400000;
  const statsModel = hourly ? HourlyStat : DailyStat;
  const [result] = await statsModel.aggregate([
    {
      $match: {
        monitor: monitorId,
        date: {
          $gte: hourly
            ? new Date(new Date(startDate).setUTCMinutes(0, 0, 0))
            : startOfDayUTC(startDate),
          $lte: hourly
            ? new Date(new Date(endDate).setUTCMinutes(0, 0, 0))
            : startOfDayUTC(endDate),
        },
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: "$totalChecks" },
        frontendUp: { $sum: "$frontendUpChecks" },
        backendUp: { $sum: "$backendUpChecks" },
        databaseUp: { $sum: "$databaseUpChecks" },
      },
    },
  ]);

  if (!result || result.total === 0) {
    return {
      frontend: null,
      backend: null,
      database: null,
      totalChecks: 0,
      basis: "observed_checks",
    };
  }

  const pct = (n) => parseFloat(((n / result.total) * 100).toFixed(2));

  return {
    frontend: pct(result.frontendUp),
    backend: pct(result.backendUp),
    database: pct(result.databaseUp),
    totalChecks: result.total,
    basis: "observed_checks",
  };
};

const summarizeTimingHistograms = (histograms = {}) =>
  Object.fromEntries(
    [
      ["dns", "dnsMs"],
      ["tcpConnect", "tcpConnectMs"],
      ["tlsHandshake", "tlsHandshakeMs"],
      ["ttfb", "ttfbMs"],
    ].map(([name, metric]) => [
      name,
      {
        sampleCount: histograms[metric]?.sampleCount || 0,
        p50: estimatePercentile(histograms[metric], 0.5),
        p95: estimatePercentile(histograms[metric], 0.95),
      },
    ]),
  );

/** Hourly chart series for short (<=2 day) analytics ranges — reuses the
 * shared bucket aggregation, sourced from raw HealthCheck documents. */
const computeHourlyChart = async (
  monitorId,
  startDate,
  endDate,
  intervalSeconds,
) => {
  const buckets = await aggregateHourlyHealthCheckBuckets(
    monitorId,
    startDate,
    endDate,
  );

  const byHour = new Map(buckets.map((bucket) => [bucket._id, bucket]));
  const points = [];
  const firstHour = new Date(startDate);
  firstHour.setUTCMinutes(0, 0, 0);
  const lastHour = new Date(endDate);
  lastHour.setUTCMinutes(0, 0, 0);
  for (
    let hour = firstHour;
    hour <= lastHour;
    hour = new Date(hour.getTime() + 60 * 60 * 1000)
  ) {
    const timestamp = hour.toISOString().slice(0, 13) + ":00:00.000Z";
    const bucket = byHour.get(timestamp);
    const start = Math.max(hour.getTime(), startDate.getTime());
    const end = Math.min(hour.getTime() + 60 * 60 * 1000, endDate.getTime());
    const expectedChecks =
      end > start
        ? Math.max(
            1,
            Math.ceil((end - start) / 1000 / (intervalSeconds || 300)),
          )
        : 0;
    points.push({
      timestamp,
      avgResponseTime: Number((bucket?.avgResponseTime || 0).toFixed(2)),
      phaseTimings: summarizeTimingHistograms(bucket?.latencyHistograms),
      p50ResponseTime: estimatePercentile(
        bucket?.latencyHistograms?.responseTime,
        0.5,
      ),
      p95ResponseTime: estimatePercentile(
        bucket?.latencyHistograms?.responseTime,
        0.95,
      ),
      p99ResponseTime: estimatePercentile(
        bucket?.latencyHistograms?.responseTime,
        0.99,
      ),
      uptimePercentage: bucket?.totalChecks
        ? Number(
            ((bucket.successfulChecks / bucket.totalChecks) * 100).toFixed(2),
          )
        : null,
      totalChecks: bucket?.totalChecks || 0,
      scheduledChecks: bucket?.scheduledChecks || 0,
      expectedChecks,
      coveragePercentage: expectedChecks
        ? Number(
            Math.min(
              100,
              ((bucket?.scheduledChecks || 0) / expectedChecks) * 100,
            ).toFixed(2),
          )
        : 0,
    });
  }
  return points;
};

/** Daily chart series for longer analytics ranges — reuses the
 * already-maintained DailyStat rollups instead of re-aggregating raw
 * HealthCheck history, keeping wide ranges (up to a plan's full
 * retention window) cheap to query. */
const computeDailyChart = async (monitorId, startDate, endDate) => {
  const stats = await DailyStat.getDateRangeStats(
    monitorId,
    startOfDayUTC(startDate),
    endOfDayUTC(endDate),
  ).lean();

  const byDate = new Map(
    stats.map((stat) => [new Date(stat.date).toISOString(), stat]),
  );
  const points = [];
  for (
    let day = startOfDayUTC(startDate), last = startOfDayUTC(endDate);
    day <= last;
    day = new Date(day.getTime() + 24 * 60 * 60 * 1000)
  ) {
    const stat = byDate.get(day.toISOString());
    points.push({
      timestamp: day,
      avgResponseTime: stat?.avgResponseTime || 0,
      phaseTimings: summarizeTimingHistograms(stat?.latencyHistograms),
      p50ResponseTime: estimatePercentile(
        stat?.latencyHistograms?.responseTime,
        0.5,
      ),
      p95ResponseTime: estimatePercentile(
        stat?.latencyHistograms?.responseTime,
        0.95,
      ),
      p99ResponseTime: estimatePercentile(
        stat?.latencyHistograms?.responseTime,
        0.99,
      ),
      uptimePercentage: stat?.totalChecks ? stat.uptimePercentage : null,
      totalChecks: stat?.totalChecks || 0,
      successfulChecks: stat?.successfulChecks || 0,
      failedChecks: stat?.failedChecks || 0,
      degradedChecks: stat?.degradedChecks || 0,
      unknownChecks: stat?.unknownChecks || 0,
      expectedChecks: stat?.expectedChecks || 0,
      coveragePercentage: stat?.coveragePercentage || 0,
      downtimeSeconds: stat?.estimatedDowntimeSeconds || 0,
    });
  }
  return points;
};

/**
 * Monitor analytics / performance insights — the aggregated payload
 * behind the frontend's Analytics tab
 */
export const getMonitorAnalytics = async (monitorId, query, user) => {
  const ownerId = user.id || user._id.toString();
  const id = new mongoose.Types.ObjectId(monitorId);

  const monitor = await Monitor.findOne({ _id: id, owner: ownerId })
    .select("name url interval active createdAt performanceAlerts owner")
    .lean();
  if (!monitor) {
    throw ApiError.notFound(`Monitor not found with id: ${monitorId}`);
  }

  const { startDate, endDate } = resolveAnalyticsRange(query);
  const spanDays = daysBetween(startDate, endDate);
  const granularity = spanDays <= 2 ? "hourly" : "daily";

  const [overview, availability, chart, performanceAlert] = await Promise.all([
    computeOverviewStats(id, monitor, startDate, endDate),
    computeAvailabilityBreakdown(id, startDate, endDate),
    granularity === "hourly"
      ? computeHourlyChart(id, startDate, endDate, monitor.interval)
      : computeDailyChart(id, startDate, endDate),
    PerformanceAlertState.findOne({
      monitor: id,
      metric: "responseTime",
    }).lean(),
  ]);

  return {
    monitor: {
      id: monitor._id,
      name: monitor.name,
      url: monitor.url,
      interval: monitor.interval,
      active: monitor.active,
    },
    range: {
      startDate,
      endDate,
      days: spanDays,
      granularity,
    },
    overview,
    performanceAlert: performanceAlert
      ? {
          status:
            performanceAlert.baselineMedianMs == null
              ? "warming_up"
              : performanceAlert.status,
          baselineMedianMs: performanceAlert.baselineMedianMs,
          baselineMadMs: performanceAlert.baselineMadMs,
          consecutiveBreaches: performanceAlert.consecutiveBreaches,
          consecutiveRecoveries: performanceAlert.consecutiveRecoveries,
          settings: monitor.performanceAlerts,
        }
      : {
          status: "warming_up",
          baselineMedianMs: null,
          baselineMadMs: null,
          consecutiveBreaches: 0,
          consecutiveRecoveries: 0,
          settings: monitor.performanceAlerts,
        },
    availability,
    chart,
  };
};

// ── Dashboard summary (aggregated) ───────────────────────────────────────────

/**
 * Current status + latest response time for up to `limit` owned monitors,
 * computed in a single aggregation (a $lookup for each monitor's most
 * recent health check) rather than N individual getMonitorStats calls.
 */
export const getMonitorStatusList = async (user, limit = 12) => {
  const ownerId = resolveOwnerObjectId(user);

  const monitors = await Monitor.aggregate([
    { $match: { owner: ownerId, active: true } },
    { $sort: { createdAt: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: "healthchecks",
        let: { monitorId: "$_id" },
        pipeline: [
          { $match: { $expr: { $eq: ["$monitor", "$$monitorId"] } } },
          { $sort: { checkedAt: -1 } },
          { $limit: 1 },
          { $project: { status: 1, responseTime: 1, checkedAt: 1 } },
        ],
        as: "latestCheck",
      },
    },
    {
      $addFields: {
        latestCheck: { $arrayElemAt: ["$latestCheck", 0] },
      },
    },
    {
      $project: {
        name: 1,
        url: 1,
        interval: 1,
        status: "$latestCheck.status",
        responseTime: "$latestCheck.responseTime",
        checkedAt: "$latestCheck.checkedAt",
      },
    },
  ]);

  const uptimeByMonitor = monitors.length
    ? await DailyStat.aggregate([
        {
          $match: {
            monitor: { $in: monitors.map((monitor) => monitor._id) },
            date: { $gte: startOfDayUTC(msBefore(WINDOW_MS["24h"])) },
          },
        },
        {
          $group: {
            _id: "$monitor",
            totalChecks: { $sum: "$totalChecks" },
            successfulChecks: { $sum: "$successfulChecks" },
          },
        },
      ])
    : [];
  const uptimeById = new Map(
    uptimeByMonitor.map((row) => [String(row._id), row]),
  );

  return monitors.map((m) => {
    let status = m.status || HEALTH_STATUS.UNKNOWN;
    if (m.checkedAt && isStale(m.checkedAt, m.interval)) {
      status = HEALTH_STATUS.UNKNOWN;
    }
    return {
      id: m._id,
      name: m.name,
      url: m.url,
      status,
      responseTime: m.responseTime ?? null,
      checkedAt: m.checkedAt ?? null,
      uptimePercentage: uptimeById.get(String(m._id))?.totalChecks
        ? Number(
            (
              (uptimeById.get(String(m._id)).successfulChecks /
                uptimeById.get(String(m._id)).totalChecks) *
              100
            ).toFixed(2),
          )
        : null,
    };
  });
};

/** Number of calendar days a named window (see config/constants.js#WINDOW_MS) spans. */
const windowDays = (window) => WINDOW_MS[window] / (24 * 60 * 60 * 1000);

export const getSystemChartData = async (user, windows = WINDOW_KEYS) => {
  const ownedIds = await getOwnedMonitorIds(user);

  const definition = getPlanDefinition(user.plan);
  const retentionDays = definition?.limits.dataRetentionDays ?? 0;

  if (!ownedIds.length) {
    return Object.fromEntries(windows.map((w) => [w, []]));
  }

  const results = await Promise.all(
    windows.map(async (window) => {
      if (windowDays(window) > retentionDays) {
        return [window, []];
      }

      const windowMs = WINDOW_MS[window];
      const since = msBefore(windowMs);

      if (window === "24h") {
        const now = new Date();
        const schedules = await Monitor.find({
          owner: resolveOwnerObjectId(user),
          active: true,
        })
          .select("interval createdAt")
          .lean();
        const buckets = await HourlyStat.aggregate([
          {
            $match: {
              monitor: { $in: ownedIds },
              date: { $gte: new Date(new Date(since).setUTCMinutes(0, 0, 0)) },
            },
          },
          {
            $group: {
              _id: {
                $dateToString: {
                  format: "%Y-%m-%dT%H:00:00.000Z",
                  date: "$date",
                },
              },
              totalChecks: { $sum: "$totalChecks" },
              scheduledChecks: { $sum: "$scheduledChecks" },
              successfulChecks: { $sum: "$successfulChecks" },
              weightedRt: {
                $sum: {
                  $ifNull: [
                    "$_responseTimeSum",
                    { $multiply: ["$avgResponseTime", "$totalChecks"] },
                  ],
                },
              },
            },
          },
          {
            $addFields: {
              avgResponseTime: {
                $cond: [
                  { $gt: ["$totalChecks", 0] },
                  { $divide: ["$weightedRt", "$totalChecks"] },
                  0,
                ],
              },
            },
          },
          { $sort: { _id: 1 } },
        ]);

        const byHour = new Map(buckets.map((bucket) => [bucket._id, bucket]));
        const chart = [];
        const firstHour = new Date(since);
        firstHour.setUTCMinutes(0, 0, 0);
        const lastHour = new Date(now);
        lastHour.setUTCMinutes(0, 0, 0);
        for (
          let hour = firstHour;
          hour <= lastHour;
          hour = new Date(hour.getTime() + 60 * 60 * 1000)
        ) {
          const timestamp = hour.toISOString().slice(0, 13) + ":00:00.000Z";
          const bucket = byHour.get(timestamp);
          const start = Math.max(hour.getTime(), since.getTime());
          const end = Math.min(hour.getTime() + 60 * 60 * 1000, now.getTime());
          const expectedChecks = schedules.reduce((sum, schedule) => {
            const eligibleStart = Math.max(
              start,
              new Date(schedule.createdAt || since).getTime(),
            );
            const seconds = Math.max(0, (end - eligibleStart) / 1000);
            return (
              sum +
              (seconds > 0
                ? Math.max(1, Math.ceil(seconds / (schedule.interval || 300)))
                : 0)
            );
          }, 0);
          chart.push({
            timestamp,
            avgResponseTime: Number((bucket?.avgResponseTime || 0).toFixed(2)),
            uptimePercentage: bucket?.totalChecks
              ? Number(
                  (
                    (bucket.successfulChecks / bucket.totalChecks) *
                    100
                  ).toFixed(2),
                )
              : null,
            totalChecks: bucket?.totalChecks || 0,
            expectedChecks,
            coveragePercentage: expectedChecks
              ? Number(
                  Math.min(
                    100,
                    ((bucket?.scheduledChecks || 0) / expectedChecks) * 100,
                  ).toFixed(2),
                )
              : 0,
          });
        }
        return [window, chart];
      }

      const startDate = startOfDayUTC(since);
      const endDate = endOfDayUTC(new Date());

      const dailyBuckets = await DailyStat.aggregate([
        {
          $match: {
            monitor: { $in: ownedIds },
            date: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: "$date",
            totalChecks: { $sum: "$totalChecks" },
            successfulChecks: { $sum: "$successfulChecks" },
            failedChecks: { $sum: "$failedChecks" },
            degradedChecks: { $sum: "$degradedChecks" },
            unknownChecks: { $sum: "$unknownChecks" },
            expectedChecks: { $sum: "$expectedChecks" },
            estimatedDowntimeSeconds: { $sum: "$estimatedDowntimeSeconds" },
            weightedRt: {
              $sum: { $multiply: ["$avgResponseTime", "$totalChecks"] },
            },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      const byDate = new Map(
        dailyBuckets.map((bucket) => [
          new Date(bucket._id).toISOString(),
          bucket,
        ]),
      );
      const chart = [];
      for (
        let day = startDate;
        day <= startOfDayUTC(new Date());
        day = new Date(day.getTime() + 24 * 60 * 60 * 1000)
      ) {
        const b = byDate.get(day.toISOString());
        chart.push({
          timestamp: day,
          avgResponseTime:
            b?.totalChecks > 0
              ? parseFloat((b.weightedRt / b.totalChecks).toFixed(2))
              : 0,
          uptimePercentage:
            b?.totalChecks > 0
              ? parseFloat(
                  ((b.successfulChecks / b.totalChecks) * 100).toFixed(2),
                )
              : null,
          totalChecks: b?.totalChecks || 0,
          expectedChecks: b?.expectedChecks || 0,
          coveragePercentage: b?.expectedChecks
            ? Number(
                Math.min(100, (b.totalChecks / b.expectedChecks) * 100).toFixed(
                  2,
                ),
              )
            : 0,
          failedChecks: b?.failedChecks || 0,
          degradedChecks: b?.degradedChecks || 0,
          unknownChecks: b?.unknownChecks || 0,
          downtimeSeconds: b?.estimatedDowntimeSeconds || 0,
        });
      }
      return [window, chart];
    }),
  );

  return Object.fromEntries(results);
};

/**
 * Single aggregated payload for the dashboard page: overview KPIs, the
 * monitor status grid, and the full-window system chart — all three run in
 * parallel and are returned together so the frontend needs exactly one
 * request instead of assembling them from many.
 */
export const getDashboardSummary = async (user) => {
  const [overview, monitorStatusList, chartData] = await Promise.all([
    getOverview(user),
    getMonitorStatusList(user, 12),
    getSystemChartData(user, WINDOW_KEYS),
  ]);

  return { overview, monitorStatusList, chartData };
};
