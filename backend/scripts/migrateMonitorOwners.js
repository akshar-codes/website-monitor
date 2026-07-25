/**
 * One-off migration: backfills `owner` on Monitor documents created
 * before per-user monitor ownership existed (see src/models/Monitor.js).
 *
 * REQUIRED before deploying this change against any database that
 * already has monitors: `owner` is now a required field used to scope
 * monitor listing, the dashboard, incidents, and plan-based monitor
 * limits to a single user. Any monitor left without an owner becomes
 * invisible to every user (it will never match an `{ owner: <id> }`
 * filter) until this script — or an equivalent manual fix — runs.
 *
 * By default every orphaned monitor is assigned to the earliest-created
 * admin account. Pass --email=<address> to target a specific user
 * instead (e.g. if monitors should be split up manually afterward).
 *
 * Usage:
 *   node scripts/migrateMonitorOwners.js
 *   node scripts/migrateMonitorOwners.js --email=admin@example.com
 */
import mongoose from "mongoose";
import env from "../src/config/env.js";
import logger from "../src/utils/logger.js";
import User from "../src/models/User.js";
import Monitor from "../src/models/Monitor.js";
import { ROLES } from "../src/config/constants.js";

const parseArgs = () => {
  const args = {};
  for (const arg of process.argv.slice(2)) {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) args[match[1]] = match[2];
  }
  return args;
};

const run = async () => {
  const { email } = parseArgs();

  await mongoose.connect(env.MONGO_URI);
  logger.info("Connected to MongoDB for monitor-owner migration");

  const orphaned = await Monitor.find({
    $or: [{ owner: { $exists: false } }, { owner: null }],
  }).select("_id name url");

  if (orphaned.length === 0) {
    logger.info("No orphaned monitors found — nothing to migrate");
    await mongoose.disconnect();
    return;
  }

  const targetUser = email
    ? await User.findByEmail(email)
    : await User.findOne({ role: ROLES.ADMIN }).sort({ createdAt: 1 });

  if (!targetUser) {
    logger.error(
      email
        ? `No user found with email "${email}" — aborting migration`
        : "No admin user found to assign orphaned monitors to — rerun with --email=<address> to target a specific account",
    );
    await mongoose.disconnect();
    process.exit(1);
    return;
  }

  const result = await Monitor.updateMany(
    { _id: { $in: orphaned.map((m) => m._id) } },
    { $set: { owner: targetUser._id } },
  );

  logger.info(
    `Assigned ${result.modifiedCount} orphaned monitor(s) to ${targetUser.email} (${targetUser._id})`,
  );

  for (const m of orphaned) {
    logger.debug(`  - ${m.name} (${m.url})`);
  }

  await mongoose.disconnect();
};

run().catch((error) => {
  logger.error(`Monitor-owner migration failed: ${error.message}`, {
    stack: error.stack,
  });
  process.exit(1);
});
