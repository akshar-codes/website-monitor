/**
 * Rebuild daily rollups from canonical health-check records.
 *
 * Usage:
 *   npm run reconcile:daily-stats
 *   npm run reconcile:daily-stats -- --monitor=<monitorId> --start=2026-01-01 --end=2026-01-31
 */
import mongoose from "mongoose";
import env from "../src/config/env.js";
import logger from "../src/utils/logger.js";
import Monitor from "../src/models/Monitor.js";
import HealthCheck from "../src/models/HealthCheck.js";
import { reconcileDailyStatsForRange } from "../src/workers/aggregationManager.js";
import { startOfDayUTC, endOfDayUTC } from "../src/utils/dateUtils.js";

const parseArgs = () => Object.fromEntries(process.argv.slice(2).flatMap((arg) => {
  const match = arg.match(/^--([^=]+)=(.*)$/);
  return match ? [[match[1], match[2]]] : [];
}));

const parseDate = (value, end = false) => {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Dates must use YYYY-MM-DD format");
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error(`Invalid date: ${value}`);
  return end ? endOfDayUTC(date) : startOfDayUTC(date);
};

const run = async () => {
  const { monitor: monitorId, start, end } = parseArgs();
  const startDate = parseDate(start);
  const endDate = parseDate(end, true);
  if (Boolean(startDate) !== Boolean(endDate)) throw new Error("Provide both --start and --end, or neither");
  if (startDate && startDate > endDate) throw new Error("--start must be earlier than or equal to --end");

  await mongoose.connect(env.MONGO_URI);
  const monitors = await Monitor.find(monitorId ? { _id: monitorId } : {}).select("_id name interval createdAt").lean();
  let rebuiltDays = 0;
  for (const monitor of monitors) {
    const first = startDate
      ? { checkedAt: startDate }
      : await HealthCheck.findOne({ monitor: monitor._id }).sort({ checkedAt: 1 }).select("checkedAt").lean();
    const last = endDate
      ? { checkedAt: endDate }
      : await HealthCheck.findOne({ monitor: monitor._id }).sort({ checkedAt: -1 }).select("checkedAt").lean();
    if (!first || !last) continue;
    const result = await reconcileDailyStatsForRange(monitor, first.checkedAt, last.checkedAt);
    rebuiltDays += result.length;
    logger.info("Rebuilt monitor daily statistics", { monitorId: String(monitor._id), days: result.length });
  }
  logger.info("Daily statistics reconciliation complete", { monitors: monitors.length, rebuiltDays });
  await mongoose.disconnect();
};

run().catch(async (error) => {
  logger.error("Daily statistics reconciliation failed", { error: error.message, stack: error.stack });
  await mongoose.disconnect();
  process.exitCode = 1;
});
