import mongoose from "mongoose";
import Monitor from "../models/Monitor.js";
import HealthCheck from "../models/HealthCheck.js";
import Incident from "../models/Incident.js";
import DailyStat from "../models/DailyStat.js";
import ApiError from "../utils/ApiError.js";
import { WINDOW_MS } from "../config/constants.js";
import { startOfDayUTC, endOfDayUTC, msBefore } from "../utils/dateUtils.js";

// ── Overview ─────────────────────────────────────────────────────────────────

export const getOverview = async () => {
  const since = msBefore(WINDOW_MS["24h"]);

  const [
    monitorCounts,
    latestPerMonitor,
    systemStats,
    activeIncidentCount,
    latestIncidents,
    recentChecks,
  ] = await Promise.all([
    // 1 ─ Monitor counts (single pass, tiny collection)
    Monitor.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: { $sum: { $cond: ["$active", 1, 0] } },
          inactive: { $sum: { $cond: ["$active", 0, 1] } },
        },
      },
    ]),

    // 2 ─ Latest health check per active monitor
    //     Uses compound index { monitor: 1, checkedAt: -1 }
    HealthCheck.aggregate([
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

    // 3 ─ System-wide uptime + avg response time (last 24 h)
    HealthCheck.aggregate([
      { $match: { checkedAt: { $gte: since } } },
      {
        $group: {
          _id: null,
          totalChecks: { $sum: 1 },
          successfulChecks: {
            $sum: { $cond: [{ $eq: ["$status", "up"] }, 1, 0] },
          },
          avgResponseTime: { $avg: "$responseTime" },
        },
      },
    ]),

    // 4 ─ Active incident count
    Incident.countDocuments({ status: { $ne: "resolved" } }),

    // 5 ─ Latest active incidents (preview — top 5)
    Incident.find({ status: { $ne: "resolved" } })
      .populate("monitor", "name url")
      .sort({ startedAt: -1 })
      .limit(5)
      .lean(),

    // 6 ─ Most recent health checks (last 10)
    HealthCheck.find()
      .populate("monitor", "name url")
      .select("-rawResponse -__v")
      .sort({ checkedAt: -1 })
      .limit(10)
      .lean(),
  ]);

  // ── Format response ──

  const counts = monitorCounts[0] || { total: 0, active: 0, inactive: 0 };

  const currentStatus = { up: 0, down: 0, degraded: 0, unknown: 0 };
  const now = Date.now();

  for (const doc of latestPerMonitor) {
    const ageMs = now - new Date(doc.checkedAt).getTime();
    const staleThresholdMs = (doc.interval || 300) * 2 * 1000;

    if (ageMs > staleThresholdMs) {
      currentStatus.unknown++;
    } else if (doc.status in currentStatus) {
      currentStatus[doc.status]++;
    } else {
      currentStatus.unknown++;
    }
  }

  // Active monitors that have never been checked have no HealthCheck document.
  const neverChecked = Math.max(0, counts.active - latestPerMonitor.length);
  currentStatus.unknown += neverChecked;

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

export const getActiveIncidents = async ({ page, limit, severity }) => {
  const filter = { status: { $ne: "resolved" } };
  if (severity) filter.severity = severity;

  const skip = (page - 1) * limit;

  const [incidents, total] = await Promise.all([
    Incident.find(filter)
      .populate("monitor", "name url")
      .populate(
        "triggerCheck",
        "status responseTime httpStatus failureReason checkedAt",
      )
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

export const getRecentHealthChecks = async ({ monitorId, status, limit }) => {
  const filter = {};

  if (monitorId) {
    filter.monitor = new mongoose.Types.ObjectId(monitorId);
  }
  if (status) {
    filter.status = status;
  }

  return HealthCheck.find(filter)
    .populate("monitor", "name url")
    .select("-rawResponse -__v")
    .sort({ checkedAt: -1 })
    .limit(limit)
    .lean();
};

// ── Per-monitor stats ─────────────────────────────────────────────────────────

export const getMonitorStats = async (monitorId, { window }) => {
  const id = new mongoose.Types.ObjectId(monitorId);

  const monitor = await Monitor.findById(id)
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
      .populate(
        "triggerCheck",
        "status responseTime httpStatus failureReason checkedAt",
      )
      .lean(),
  ]);

  let currentStatus = latestCheck?.status || "unknown";
  if (latestCheck && monitor.interval) {
    const ageMs = Date.now() - new Date(latestCheck.checkedAt).getTime();
    const staleThresholdMs = monitor.interval * 2 * 1000;
    if (ageMs > staleThresholdMs) {
      currentStatus = "unknown";
    }
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

export const getMonitorChartData = async (monitorId, { window }) => {
  const id = new mongoose.Types.ObjectId(monitorId);

  const monitor = await Monitor.findById(id).select("_id").lean();
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
            $sum: { $cond: [{ $eq: ["$status", "up"] }, 1, 0] },
          },
          failedChecks: {
            $sum: { $cond: [{ $eq: ["$status", "down"] }, 1, 0] },
          },
          degradedChecks: {
            $sum: { $cond: [{ $eq: ["$status", "degraded"] }, 1, 0] },
          },
          unknownChecks: {
            $sum: { $cond: [{ $eq: ["$status", "unknown"] }, 1, 0] },
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
          ? parseFloat(
              ((b.successfulChecks / b.totalChecks) * 100).toFixed(2),
            )
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
