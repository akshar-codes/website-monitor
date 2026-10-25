import HealthCheck from "../models/HealthCheck.js";
import env from "../config/env.js";
import logger from "../utils/logger.js";

const RESPONSE_HISTORY_LIMIT = 10;
let lastPrunedMonitorId = null;

/** Keep response snapshots only on each monitor's ten newest checks. */
export const pruneMonitorResponseSnapshots = async (
  monitorId,
  checks = HealthCheck,
) => {
  try {
    const newestChecks = await checks
      .find({ monitor: monitorId })
      .select("_id checkedAt")
      .sort({ checkedAt: -1, _id: -1 })
      .limit(RESPONSE_HISTORY_LIMIT)
      .lean();

    if (newestChecks.length < RESPONSE_HISTORY_LIMIT) return 0;

    const oldestKept = newestChecks.at(-1);
    const result = await checks.updateMany(
      {
        monitor: monitorId,
        rawResponse: { $type: "object" },
        $or: [
          { checkedAt: { $lt: oldestKept.checkedAt } },
          {
            checkedAt: oldestKept.checkedAt,
            _id: { $lt: oldestKept._id },
          },
        ],
      },
      { $unset: { rawResponse: 1 } },
    );

    return result.modifiedCount || 0;
  } catch (error) {
    logger.warn("Could not prune old health response snapshots", {
      monitorId: String(monitorId),
      error: error.message,
    });
    return 0;
  }
};

/** Walk monitors in bounded pages to clean old response snapshots after upgrades. */
export const pruneExcessResponseSnapshots = async (
  checks = HealthCheck,
  batchSize = env.MONITOR_RETENTION_BATCH_SIZE,
) => {
  const monitorBatchSize = Math.min(batchSize, 100);
  let overfullMonitors;
  try {
    overfullMonitors = await checks.aggregate([
      { $match: { rawResponse: { $type: "object" } } },
      { $group: { _id: "$monitor" } },
      ...(lastPrunedMonitorId
        ? [{ $match: { _id: { $gt: lastPrunedMonitorId } } }]
        : []),
      { $sort: { _id: 1 } },
      { $limit: monitorBatchSize },
    ]);
  } catch (error) {
    logger.warn("Could not scan health response snapshots for cleanup", {
      error: error.message,
    });
    return 0;
  }

  let snapshotsPruned = 0;
  for (const { _id } of overfullMonitors) {
    snapshotsPruned += await pruneMonitorResponseSnapshots(_id, checks);
  }
  lastPrunedMonitorId =
    overfullMonitors.length === monitorBatchSize
      ? overfullMonitors.at(-1)._id
      : null;
  return snapshotsPruned;
};
