const DailyStat = require("../models/DailyStat");
const logger = require("../utils/logger");

const todayUTC = () => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

const updateDailyStat = async (monitor, healthCheck) => {
  const date = todayUTC();
  const isSuccess = healthCheck.status === "up";
  const rt = healthCheck.responseTime;

  // Seconds of downtime / degradation this check represents.
  // Each check covers approximately `monitor.interval` seconds.
  const downtimeAdd = healthCheck.status === "down" ? monitor.interval : 0;
  const degradedAdd = healthCheck.status === "degraded" ? monitor.interval : 0;

  try {
    const stat = await DailyStat.findOneAndUpdate(
      { monitor: monitor._id, date },
      [
        // Stage 1 — increment counters and update extremes
        {
          $set: {
            monitor: monitor._id,
            date,

            totalChecks: { $add: [{ $ifNull: ["$totalChecks", 0] }, 1] },

            successfulChecks: {
              $add: [{ $ifNull: ["$successfulChecks", 0] }, isSuccess ? 1 : 0],
            },

            failedChecks: {
              $add: [{ $ifNull: ["$failedChecks", 0] }, isSuccess ? 0 : 1],
            },

            _responseTimeSum: {
              $add: [{ $ifNull: ["$_responseTimeSum", 0] }, rt],
            },

            minResponseTime: {
              $min: [{ $ifNull: ["$minResponseTime", rt] }, rt],
            },

            maxResponseTime: {
              $max: [{ $ifNull: ["$maxResponseTime", 0] }, rt],
            },

            downtimeSeconds: {
              $add: [{ $ifNull: ["$downtimeSeconds", 0] }, downtimeAdd],
            },

            degradedSeconds: {
              $add: [{ $ifNull: ["$degradedSeconds", 0] }, degradedAdd],
            },
          },
        },

        // Stage 2 — derive computed fields from the updated counters
        {
          $set: {
            avgResponseTime: {
              $round: [{ $divide: ["$_responseTimeSum", "$totalChecks"] }, 2],
            },

            uptimePercentage: {
              $round: [
                {
                  $multiply: [
                    { $divide: ["$successfulChecks", "$totalChecks"] },
                    100,
                  ],
                },
                2,
              ],
            },
          },
        },
      ],

      { upsert: true, new: true, updatePipeline: true },
    );

    return stat;
  } catch (error) {
    // Aggregation failures must not break the polling pipeline
    logger.error(
      `Failed to update DailyStat for monitor ${monitor._id}: ${error.message}`,
    );
    return null;
  }
};

module.exports = { updateDailyStat };
