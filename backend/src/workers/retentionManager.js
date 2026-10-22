import HealthCheck from "../models/HealthCheck.js";
import Incident from "../models/Incident.js";
import env from "../config/env.js";

/**
 * Delete a bounded page of old checks while preserving all samples referenced
 * by incident records. DailyStat is an independent aggregate and is retained.
 * Diagnostics have a shorter, independent retention window.
 */
export const runRetentionPass = async (deps = {}) => {
  const checks = deps.HealthCheck || HealthCheck;
  const incidents = deps.Incident || Incident;
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
      $or: [{ diagnostics: { $ne: null } }, { rawResponse: { $ne: null } }],
    })
    .select("_id")
    .sort({ checkedAt: 1 })
    .limit(batchSize)
    .lean();
  if (diagnosticRows.length) {
    await checks.updateMany(
      { _id: { $in: diagnosticRows.map(({ _id }) => _id) } },
      { $unset: { diagnostics: 1, rawResponse: 1 } },
    );
  }

  const candidates = await checks
    .find({ checkedAt: { $lt: checkCutoff } })
    .select("_id")
    .sort({ checkedAt: 1 })
    .limit(batchSize)
    .lean();
  if (!candidates.length) {
    return { diagnosticsRedacted: diagnosticRows.length, checksDeleted: 0 };
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
    checksDeleted: deleted.deletedCount || 0,
    checksProtected: protectedIds.size,
  };
};
