import HealthCheck from "../models/HealthCheck.js";
import Incident from "../models/Incident.js";
import DailyStat from "../models/DailyStat.js";
import env from "../config/env.js";
import { pruneExcessResponseSnapshots } from "../services/healthResponseRetention.service.js";

let checkRetentionCursor = null;

/**
 * Delete bounded pages of expired checks and daily aggregates while preserving
 * samples referenced by incidents. Response snapshots are capped separately
 * at ten per monitor; diagnostics have a shorter retention window.
 */
export const runRetentionPass = async (deps = {}) => {
  const checks = deps.HealthCheck || HealthCheck;
  const incidents = deps.Incident || Incident;
  const dailyStats = deps.DailyStat || DailyStat;
  const now = deps.now || new Date();
  const batchSize = deps.batchSize || env.MONITOR_RETENTION_BATCH_SIZE;
  const checkCutoff = new Date(
    now.getTime() - env.MONITOR_RETENTION_DAYS * 86_400_000,
  );
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

  const dailyStatCutoff = new Date(
    now.getTime() - env.MONITOR_RETENTION_DAYS * 86_400_000,
  );
  const expiredDailyRows = await dailyStats
    .find({ date: { $lt: dailyStatCutoff } })
    .select("_id")
    .sort({ date: 1, _id: 1 })
    .limit(batchSize)
    .lean();
  const dailyStatsDeleted = expiredDailyRows.length
    ? (
        await dailyStats.deleteMany({
          _id: { $in: expiredDailyRows.map(({ _id }) => _id) },
          date: { $lt: dailyStatCutoff },
        })
      ).deletedCount || 0
    : 0;

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
      checksDeleted: 0,
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
    checksDeleted: deleted.deletedCount || 0,
    checksProtected: protectedIds.size,
  };
};
