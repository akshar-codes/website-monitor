import mongoose from "mongoose";
import Monitor from "../models/Monitor.js";
import HealthCheck from "../models/HealthCheck.js";
import Incident from "../models/Incident.js";
import DailyStat from "../models/DailyStat.js";
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
} from "../utils/dateUtils.js";
import { getOwnedMonitorIds } from "./monitor.service.js";
import { getPlanDefinition } from "../config/plans.js";

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
    HealthCheck.aggregate([
      {
        $match: {
          monitor: { $in: ownedIds },
          checkedAt: { $gte: since },
        },
      },
      {
        $group: {
          _id: null,
          totalChecks: { $sum: 1 },
          successfulChecks: {
            $sum: { $cond: [{ $eq: ["$status", HEALTH_STATUS.UP] }, 1, 0] },
          },
          avgResponseTime: { $avg: "$responseTime" },
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
    successfulChecks: 0,
    avgResponseTime: 0,
  };

  const uptimePercentage =
    stats.totalChecks > 0
      ? parseFloat(
          ((stats.successfulChecks / stats.totalChecks) * 100).toFixed(2),
        )
      : 0;

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
      "name url active interval lastCheckedAt nextCheckAt consecutiveFailures",
    )
    .lean();
  if (!monitor) {
    throw ApiError.notFound(`Monitor not found with id: ${monitorId}`);
  }

  const windowMs = WINDOW_MS[window];
  const since = msBefore(windowMs);
  const useDaily = window !== "24h";

  let uptimePercentage, responseTimeStats;

  if (useDaily) {
    const startDate = startOfDayUTC(since);
    const endDate = endOfDayUTC(new Date());

    const [uptime, dailyStats] = await Promise.all([
      DailyStat.calculateUptime(id, startDate, endDate),
      DailyStat.getDateRangeStats(id, startDate, endDate).lean(),
    ]);

    uptimePercentage = uptime;

    if (dailyStats.length > 0) {
      const totalChecks = dailyStats.reduce((sum, d) => sum + d.totalChecks, 0);
      const weightedRt = dailyStats.reduce(
        (sum, d) => sum + d.avgResponseTime * d.totalChecks,
        0,
      );

      responseTimeStats = {
        average:
          totalChecks > 0
            ? parseFloat((weightedRt / totalChecks).toFixed(2))
            : 0,
        min: Math.min(...dailyStats.map((d) => d.minResponseTime)),
        max: Math.max(...dailyStats.map((d) => d.maxResponseTime)),
      };
    } else {
      responseTimeStats = { average: 0, min: 0, max: 0 };
    }
  } else {
    const [uptime, rtAgg] = await Promise.all([
      HealthCheck.uptimePercent(id, windowMs),
      HealthCheck.aggregate([
        { $match: { monitor: id, checkedAt: { $gte: since } } },
        {
          $group: {
            _id: null,
            avg: { $avg: "$responseTime" },
            min: { $min: "$responseTime" },
            max: { $max: "$responseTime" },
          },
        },
      ]),
    ]);

    uptimePercentage = uptime;
    const rt = rtAgg[0] || { avg: 0, min: 0, max: 0 };
    responseTimeStats = {
      average: parseFloat((rt.avg || 0).toFixed(2)),
      min: rt.min || 0,
      max: rt.max || 0,
    };
  }

  const [latestCheck, recentChecks, activeIncident] = await Promise.all([
    HealthCheck.findLatest(id),
    HealthCheck.find({ monitor: id })
      .select("-rawResponse -__v")
      .sort({ checkedAt: -1 })
      .limit(20)
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
    },
    currentStatus,
    lastCheckedAt: monitor.lastCheckedAt,
    nextCheckAt: monitor.nextCheckAt,
    consecutiveFailures: monitor.consecutiveFailures,
    uptime: {
      percentage: uptimePercentage,
      window,
    },
    responseTime: {
      ...responseTimeStats,
      window,
    },
    activeIncident,
    recentChecks,
  };
};

// ── Per-monitor chart data ────────────────────────────────────────────────────

export const getMonitorChartData = async (monitorId, { window }, user) => {
  const ownerId = user.id || user._id.toString();
  const id = new mongoose.Types.ObjectId(monitorId);

  const monitor = await Monitor.findOne({ _id: id, owner: ownerId })
    .select("_id")
    .lean();
  if (!monitor) {
    throw ApiError.notFound(`Monitor not found with id: ${monitorId}`);
  }

  const windowMs = WINDOW_MS[window];
  const since = msBefore(windowMs);

  let dataPoints;

  if (window === "24h") {
    const buckets = await HealthCheck.aggregate([
      { $match: { monitor: id, checkedAt: { $gte: since } } },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%dT%H:00:00.000Z",
              date: "$checkedAt",
            },
          },
          avgResponseTime: { $avg: "$responseTime" },
          minResponseTime: { $min: "$responseTime" },
          maxResponseTime: { $max: "$responseTime" },
          totalChecks: { $sum: 1 },
          successfulChecks: {
            $sum: { $cond: [{ $eq: ["$status", HEALTH_STATUS.UP] }, 1, 0] },
          },
          failedChecks: {
            $sum: { $cond: [{ $eq: ["$status", HEALTH_STATUS.DOWN] }, 1, 0] },
          },
          degradedChecks: {
            $sum: {
              $cond: [{ $eq: ["$status", HEALTH_STATUS.DEGRADED] }, 1, 0],
            },
          },
          unknownChecks: {
            $sum: {
              $cond: [{ $eq: ["$status", HEALTH_STATUS.UNKNOWN] }, 1, 0],
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    dataPoints = buckets.map((b) => ({
      timestamp: b._id,
      avgResponseTime: parseFloat((b.avgResponseTime || 0).toFixed(2)),
      minResponseTime: b.minResponseTime || 0,
      maxResponseTime: b.maxResponseTime || 0,
      totalChecks: b.totalChecks,
      successfulChecks: b.successfulChecks,
      failedChecks: b.failedChecks,
      degradedChecks: b.degradedChecks,
      unknownChecks: b.unknownChecks,
      uptimePercentage:
        b.totalChecks > 0
          ? parseFloat(((b.successfulChecks / b.totalChecks) * 100).toFixed(2))
          : 0,
    }));
  } else {
    const startDate = startOfDayUTC(since);
    const endDate = endOfDayUTC(new Date());

    const dailyStats = await DailyStat.getDateRangeStats(
      id,
      startDate,
      endDate,
    ).lean();

    dataPoints = dailyStats.map((doc) => ({
      timestamp: doc.date,
      avgResponseTime: doc.avgResponseTime,
      minResponseTime: doc.minResponseTime,
      maxResponseTime: doc.maxResponseTime,
      totalChecks: doc.totalChecks,
      successfulChecks: doc.successfulChecks,
      failedChecks: doc.failedChecks,
      degradedChecks: doc.totalChecks - doc.successfulChecks - doc.failedChecks,
      unknownChecks: 0,
      uptimePercentage: doc.uptimePercentage,
    }));
  }

  return {
    monitorId,
    window,
    dataPoints,
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
    };
  });
};

/** Number of calendar days a named window (see config/constants.js#WINDOW_MS) spans. */
const windowDays = (window) => WINDOW_MS[window] / (24 * 60 * 60 * 1000);

/**
 * True system-wide chart data — response time and uptime aggregated across
 * EVERY monitor the caller owns, for each requested window, in one pass per
 * window. A window that exceeds the caller's plan data-retention limit
 * resolves to an empty array rather than throwing, mirroring how
 * middlewares/featureAccess.js#requireWindowWithinRetention blocks the
 * equivalent single-monitor endpoint — the dashboard simply shows "no data"
 * for a window the plan doesn't retain, instead of a 403 hidden inside a
 * Promise.allSettled fan-out.
 */
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
        const buckets = await HealthCheck.aggregate([
          {
            $match: {
              monitor: { $in: ownedIds },
              checkedAt: { $gte: since },
            },
          },
          {
            $group: {
              _id: {
                $dateToString: {
                  format: "%Y-%m-%dT%H:00:00.000Z",
                  date: "$checkedAt",
                },
              },
              avgResponseTime: { $avg: "$responseTime" },
              totalChecks: { $sum: 1 },
              successfulChecks: {
                $sum: {
                  $cond: [{ $eq: ["$status", HEALTH_STATUS.UP] }, 1, 0],
                },
              },
            },
          },
          { $sort: { _id: 1 } },
        ]);

        return [
          window,
          buckets.map((b) => ({
            timestamp: b._id,
            avgResponseTime: parseFloat((b.avgResponseTime || 0).toFixed(2)),
            uptimePercentage:
              b.totalChecks > 0
                ? parseFloat(
                    ((b.successfulChecks / b.totalChecks) * 100).toFixed(2),
                  )
                : 0,
          })),
        ];
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
            weightedRt: {
              $sum: { $multiply: ["$avgResponseTime", "$totalChecks"] },
            },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      return [
        window,
        dailyBuckets.map((b) => ({
          timestamp: b._id,
          avgResponseTime:
            b.totalChecks > 0
              ? parseFloat((b.weightedRt / b.totalChecks).toFixed(2))
              : 0,
          uptimePercentage:
            b.totalChecks > 0
              ? parseFloat(
                  ((b.successfulChecks / b.totalChecks) * 100).toFixed(2),
                )
              : 0,
        })),
      ];
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
