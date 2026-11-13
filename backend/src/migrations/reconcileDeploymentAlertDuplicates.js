import mongoose from "mongoose";
import DeploymentAlertState, {
  REGRESSION_STATUSES,
  NOTIFICATION_STATES,
} from "../models/DeploymentAlertState.js";
import logger from "../utils/logger.js";

/**
 * Reconciles duplicate DeploymentAlertState documents for the same (deployment, monitor) pair.
 * Merges evaluation metrics, evidence, incident references, and notification history into
 * the latest canonical document, removes secondary duplicates, and creates/syncs the compound
 * unique index { deployment: 1, monitor: 1 }.
 */
export const reconcileDeploymentAlertDuplicates = async (options = {}) => {
  const model = options.DeploymentAlertState || DeploymentAlertState;

  if (mongoose.connection.readyState !== 1 && !options.force) {
    return { reconciledGroups: 0, deletedDuplicates: 0, skipped: true };
  }

  // 1. Group records by deployment and monitor to identify duplicates
  const duplicates = await model.aggregate([
    {
      $group: {
        _id: { deployment: "$deployment", monitor: "$monitor" },
        count: { $sum: 1 },
        docIds: { $push: "$_id" },
      },
    },
    {
      $match: {
        count: { $gt: 1 },
        "_id.deployment": { $ne: null },
        "_id.monitor": { $ne: null },
      },
    },
  ]);

  let reconciledGroups = 0;
  let deletedDuplicates = 0;

  for (const group of duplicates) {
    const ids = group.docIds;
    const docs = await model.find({ _id: { $in: ids } }).lean();
    if (docs.length <= 1) continue;

    // Sort by latest evaluated / updated time descending
    docs.sort((a, b) => {
      const timeA = new Date(
        a.lastEvaluatedAt || a.updatedAt || a.createdAt || 0,
      ).getTime();
      const timeB = new Date(
        b.lastEvaluatedAt || b.updatedAt || b.createdAt || 0,
      ).getTime();
      return timeB - timeA;
    });

    const canonical = docs[0];
    const secondaries = docs.slice(1);

    // Merge evidence (unique lines)
    const evidenceSet = new Set(canonical.evidence || []);

    // Merge incidents (unique ObjectIds)
    const incidentMap = new Map();
    (canonical.relatedIncidents || []).forEach((inc) => {
      const idStr = (inc._id || inc).toString();
      incidentMap.set(idStr, inc);
    });

    // Merge notification history
    const notificationHistoryList = [...(canonical.notificationHistory || [])];

    let hasSuspectedRegression =
      canonical.status === REGRESSION_STATUSES.SUSPECTED_REGRESSION;
    let latestDispatchedAt = canonical.alertDispatchedAt
      ? new Date(canonical.alertDispatchedAt)
      : null;
    let latestCooldownUntil = canonical.cooldownUntil
      ? new Date(canonical.cooldownUntil)
      : null;
    let canonicalNotifState =
      canonical.notificationState || NOTIFICATION_STATES.IDLE;
    let totalAttempts = canonical.notificationAttempts || 0;

    for (const sec of secondaries) {
      if (sec.status === REGRESSION_STATUSES.SUSPECTED_REGRESSION) {
        hasSuspectedRegression = true;
      }
      (sec.evidence || []).forEach((e) => evidenceSet.add(e));
      (sec.relatedIncidents || []).forEach((inc) => {
        const idStr = (inc._id || inc).toString();
        if (!incidentMap.has(idStr)) {
          incidentMap.set(idStr, inc);
        }
      });
      (sec.notificationHistory || []).forEach((nh) => {
        notificationHistoryList.push(nh);
      });
      if (sec.alertDispatchedAt) {
        const secDispatched = new Date(sec.alertDispatchedAt);
        if (!latestDispatchedAt || secDispatched > latestDispatchedAt) {
          latestDispatchedAt = secDispatched;
        }
      }
      if (sec.cooldownUntil) {
        const secCooldown = new Date(sec.cooldownUntil);
        if (!latestCooldownUntil || secCooldown > latestCooldownUntil) {
          latestCooldownUntil = secCooldown;
        }
      }
      if (sec.notificationState === NOTIFICATION_STATES.SENT) {
        canonicalNotifState = NOTIFICATION_STATES.SENT;
      }
      totalAttempts += sec.notificationAttempts || 0;
    }

    // Sort notification history chronologically
    notificationHistoryList.sort(
      (a, b) => new Date(a.attemptedAt || 0) - new Date(b.attemptedAt || 0),
    );

    // Update canonical document
    await model.updateOne(
      { _id: canonical._id },
      {
        $set: {
          status: hasSuspectedRegression
            ? REGRESSION_STATUSES.SUSPECTED_REGRESSION
            : canonical.status,
          evidence: Array.from(evidenceSet),
          relatedIncidents: Array.from(incidentMap.values()),
          notificationHistory: notificationHistoryList.slice(-20),
          alertDispatchedAt: latestDispatchedAt,
          cooldownUntil: latestCooldownUntil,
          notificationState: canonicalNotifState,
          notificationAttempts: totalAttempts,
          deduplicationKey: `${group._id.deployment}:${group._id.monitor}`,
        },
      },
    );

    // Delete duplicate secondaries
    const secondaryIds = secondaries.map((s) => s._id);
    const deleteResult = await model.deleteMany({ _id: { $in: secondaryIds } });
    deletedDuplicates += deleteResult.deletedCount || secondaryIds.length;
    reconciledGroups++;
  }

  // Ensure unique index is built
  try {
    if (model.collection && model.collection.createIndex) {
      await model.collection.createIndex(
        { deployment: 1, monitor: 1 },
        { unique: true, background: true },
      );
    }
  } catch (idxErr) {
    logger.warn(
      `Could not ensure unique index on DeploymentAlertState: ${idxErr.message}`,
    );
  }

  return { reconciledGroups, deletedDuplicates };
};
