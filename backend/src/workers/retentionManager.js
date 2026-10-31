import mongoose from "mongoose";
import HealthCheck from "../models/HealthCheck.js";
import Incident from "../models/Incident.js";
import DailyStat from "../models/DailyStat.js";
import HourlyStat from "../models/HourlyStat.js";
import RegionalCheck from "../models/RegionalCheck.js";
import RegionalProbeRun from "../models/RegionalProbeRun.js";
import RegionalIncident from "../models/RegionalIncident.js";
import RegionalDailyStat from "../models/RegionalDailyStat.js";
import RegionalHourlyStat from "../models/RegionalHourlyStat.js";
import Monitor from "../models/Monitor.js";
import env from "../config/env.js";
import { getPlanDefinition } from "../config/plans.js";
import { pruneExcessResponseSnapshots } from "../services/healthResponseRetention.service.js";
import { backfillRecentHourlyStats } from "./aggregationManager.js";

let checkRetentionCursor = null;
let checkCapSweepComplete = false;
export const MAX_STORED_HEALTH_CHECKS = 10;

export const pruneMonitorHealthChecks = async (monitorId, deps = {}) => {
  const checks = deps.HealthCheck || HealthCheck;
  const incidents = deps.Incident || Incident;
  const keep = deps.keep || MAX_STORED_HEALTH_CHECKS;
  const excess = await checks
    .find({ monitor: monitorId })
    .select(
      "_id checkedAt status responseTime httpStatus failureReason frontendStatus backendStatus databaseStatus",
    )
    .sort({ checkedAt: -1, _id: -1 })
    .skip(keep)
    .limit(deps.batchSize || 500)
    .lean();
  if (!excess.length) return 0;

  const ids = excess.map(({ _id }) => _id);
  const refs = await incidents
    .find({
      $or: [{ triggerCheck: { $in: ids } }, { recoveryCheck: { $in: ids } }],
    })
    .select(
      "triggerCheck recoveryCheck triggerCheckSnapshot recoveryCheckSnapshot",
    )
    .lean();
  const checkById = new Map(excess.map((check) => [String(check._id), check]));
  await Promise.all(
    refs.map((incident) => {
      const set = {};
      const trigger = checkById.get(String(incident.triggerCheck));
      const recovery = checkById.get(String(incident.recoveryCheck));
      if (trigger && !incident.triggerCheckSnapshot)
        set.triggerCheckSnapshot = trigger;
      if (recovery && !incident.recoveryCheckSnapshot)
        set.recoveryCheckSnapshot = recovery;
      return Object.keys(set).length
        ? incidents.updateOne({ _id: incident._id }, { $set: set })
        : null;
    }),
  );
  const result = await checks.deleteMany({ _id: { $in: ids } });
  return result.deletedCount || 0;
};

/**
 * Backfill compact hourly aggregates, cap raw health checks at ten per
 * monitor, and remove expired diagnostic/hourly/daily data in bounded pages.
 * Incident trigger and recovery context is snapshotted before its check row is
 * removed.
 */
export const runRetentionPass = async (deps = {}) => {
  const checks = deps.HealthCheck || HealthCheck;
  const incidents = deps.Incident || Incident;
  const dailyStats = deps.DailyStat || DailyStat;
  const hourlyStats = deps.HourlyStat || HourlyStat;
  const now = deps.now || new Date();
  const batchSize = deps.batchSize || env.MONITOR_RETENTION_BATCH_SIZE;
  const checkCutoff = new Date(
    now.getTime() - env.MONITOR_RETENTION_DAYS * 86_400_000,
  );

  const monitorModel = deps.Monitor || Monitor;
  const isDbAvailable =
    mongoose.connection.readyState === 1 || Boolean(deps.Monitor);
  let excessChecksDeleted = 0;
  if (!checkCapSweepComplete && isDbAvailable) {
    const monitors = await monitorModel.find({}).select("_id interval").lean();
    for (const monitor of monitors) {
      await backfillRecentHourlyStats(monitor._id, monitor.interval, {
        Monitor: monitorModel,
        HealthCheck: checks,
        HourlyStat: deps.HourlyStat || HourlyStat,
      });
      let deletedForMonitor;
      do {
        deletedForMonitor = await pruneMonitorHealthChecks(monitor._id, {
          HealthCheck: checks,
          Incident: incidents,
          batchSize,
        });
        excessChecksDeleted += deletedForMonitor;
      } while (deletedForMonitor === batchSize);
    }
    checkCapSweepComplete = true;
  }
  const diagnosticCutoff = new Date(
    now.getTime() - env.MONITOR_DIAGNOSTIC_RETENTION_DAYS * 86_400_000,
  );

  const diagnosticRows = await checks
    .find({
      checkedAt: { $lt: diagnosticCutoff },
      diagnostics: { $ne: null },
    })
    .select("_id")
    .sort({ checkedAt: 1 })
    .limit(batchSize)
    .lean();
  if (diagnosticRows.length) {
    await checks.updateMany(
      { _id: { $in: diagnosticRows.map(({ _id }) => _id) } },
      { $unset: { diagnostics: 1 } },
    );
  }

  const responseSnapshotsPruned = await pruneExcessResponseSnapshots(
    checks,
    batchSize,
  );

  let hourlyStatsDeleted = 0;
  let dailyStatsDeleted = 0;
  let regionalChecksDeleted = 0;
  let regionalStatsDeleted = 0;

  if (isDbAvailable) {
    // Keep aggregate history for the plan attached to each monitor owner.
    // Hourly and daily rollups share the same retention window so recent charts
    // and long-range summaries remain consistent across plan tiers.
    const monitorsWithPlans = await monitorModel
      .find({})
      .select("_id owner")
      .populate("owner", "plan")
      .lean();
    const pruneExpiredStats = async (model, monitorId, cutoff) => {
      const rows = await model
        .find({ monitor: monitorId, date: { $lt: cutoff } })
        .select("_id")
        .sort({ date: 1, _id: 1 })
        .limit(batchSize)
        .lean();
      if (!rows.length) return 0;
      const result = await model.deleteMany({
        _id: { $in: rows.map(({ _id }) => _id) },
        monitor: monitorId,
        date: { $lt: cutoff },
      });
      return result.deletedCount || 0;
    };
    for (const monitor of monitorsWithPlans) {
      const planId = monitor.owner?.plan;
      const planRetentionDays =
        getPlanDefinition(planId)?.limits.dataRetentionDays;
      const retentionDays = Number.isFinite(planRetentionDays)
        ? planRetentionDays
        : env.MONITOR_RETENTION_DAYS;
      const cutoff = new Date(now.getTime() - retentionDays * 86_400_000);
      hourlyStatsDeleted += await pruneExpiredStats(
        hourlyStats,
        monitor._id,
        cutoff,
      );
      dailyStatsDeleted += await pruneExpiredStats(
        dailyStats,
        monitor._id,
        cutoff,
      );
      regionalChecksDeleted +=
        (
          await RegionalCheck.deleteMany({
            monitor: monitor._id,
            completedAt: { $lt: cutoff },
          })
        ).deletedCount || 0;
      await RegionalProbeRun.deleteMany({
        monitor: monitor._id,
        scheduledAt: { $lt: cutoff },
        status: { $ne: "pending" },
      });
      await RegionalIncident.deleteMany({
        monitor: monitor._id,
        status: "resolved",
        recoveredAt: { $lt: cutoff },
      });
      for (const model of [RegionalHourlyStat, RegionalDailyStat]) {
        const removed = await model.deleteMany({
          monitor: monitor._id,
          date: { $lt: cutoff },
        });
        regionalStatsDeleted += removed.deletedCount || 0;
      }
    }
  } else {
    // Fallback for tests or disconnected environments
    const dailyStatCutoff = new Date(
      now.getTime() - env.MONITOR_RETENTION_DAYS * 86_400_000,
    );
    const expiredDailyStats = await dailyStats
      .find({ date: { $lt: dailyStatCutoff } })
      .select("_id")
      .sort({ date: 1, _id: 1 })
      .limit(batchSize)
      .lean();
    if (expiredDailyStats.length) {
      const result = await dailyStats.deleteMany({
        _id: { $in: expiredDailyStats.map(({ _id }) => _id) },
      });
      dailyStatsDeleted = result.deletedCount || 0;
    }
    if (deps.HourlyStat) {
      const expiredHourly = await hourlyStats
        .find({ date: { $lt: dailyStatCutoff } })
        .select("_id")
        .sort({ date: 1, _id: 1 })
        .limit(batchSize)
        .lean();
      if (expiredHourly.length) {
        const result = await hourlyStats.deleteMany({
          _id: { $in: expiredHourly.map(({ _id }) => _id) },
        });
        hourlyStatsDeleted = result.deletedCount || 0;
      }
    }
  }

  const candidateFilter = { checkedAt: { $lt: checkCutoff } };
  if (checkRetentionCursor) {
    candidateFilter.$or = [
      { checkedAt: { $gt: checkRetentionCursor.checkedAt } },
      {
        checkedAt: checkRetentionCursor.checkedAt,
        _id: { $gt: checkRetentionCursor.id },
      },
    ];
  }
  const candidates = await checks
    .find(candidateFilter)
    .select("_id checkedAt")
    .sort({ checkedAt: 1, _id: 1 })
    .limit(batchSize)
    .lean();
  checkRetentionCursor =
    candidates.length === batchSize
      ? {
          checkedAt: candidates.at(-1).checkedAt,
          id: candidates.at(-1)._id,
        }
      : null;
  if (!candidates.length) {
    return {
      diagnosticsRedacted: diagnosticRows.length,
      responseSnapshotsPruned,
      dailyStatsDeleted,
      hourlyStatsDeleted,
      regionalChecksDeleted,
      regionalStatsDeleted,
      checksDeleted: 0,
      excessChecksDeleted,
    };
  }

  const ids = candidates.map(({ _id }) => _id);
  const references = await incidents
    .find({
      $or: [{ triggerCheck: { $in: ids } }, { recoveryCheck: { $in: ids } }],
    })
    .select("triggerCheck recoveryCheck")
    .lean();
  const protectedIds = new Set(
    references.flatMap(({ triggerCheck, recoveryCheck }) =>
      [triggerCheck, recoveryCheck].filter(Boolean).map(String),
    ),
  );
  const deletableIds = ids.filter((id) => !protectedIds.has(String(id)));
  const deleted = deletableIds.length
    ? await checks.deleteMany({
        _id: { $in: deletableIds },
        checkedAt: { $lt: checkCutoff },
      })
    : { deletedCount: 0 };

  return {
    diagnosticsRedacted: diagnosticRows.length,
    responseSnapshotsPruned,
    dailyStatsDeleted,
    hourlyStatsDeleted,
    regionalChecksDeleted,
    regionalStatsDeleted,
    checksDeleted: deleted.deletedCount || 0,
    excessChecksDeleted,
    checksProtected: protectedIds.size,
  };
};
