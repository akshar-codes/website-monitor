import mongoose from "mongoose";
import JobMonitor from "../src/models/JobMonitor.js";
import JobRun from "../src/models/JobRun.js";
import Incident from "../src/models/Incident.js";
import { migrateActiveIncidentIndex } from "./migrateActiveIncidentIndex.js";
import env from "../src/config/env.js";

/**
 * Migration script that verifies and synchronizes MongoDB indexes for
 * JobMonitor, JobRun, and Incident collections to guarantee production performance.
 */
export async function migrateJobIndexes() {
  console.log("Starting Job Monitoring database index verification and migration...");

  // 1. Migrate Incident active index
  console.log("Verifying Incident indexes...");
  await migrateActiveIncidentIndex();

  // 2. Synchronize JobMonitor indexes
  console.log("Synchronizing JobMonitor indexes...");
  const jobMonitorIndexes = await JobMonitor.syncIndexes();
  console.log("JobMonitor synced indexes:", jobMonitorIndexes);

  // 3. Synchronize JobRun indexes
  console.log("Synchronizing JobRun indexes...");
  const jobRunIndexes = await JobRun.syncIndexes();
  console.log("JobRun synced indexes:", jobRunIndexes);

  // 4. Log active indexes for audit verification
  const jmActive = await JobMonitor.collection.indexes();
  console.log(`JobMonitor active indexes count: ${jmActive.length}`);
  jmActive.forEach((idx) => console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}`));

  const jrActive = await JobRun.collection.indexes();
  console.log(`JobRun active indexes count: ${jrActive.length}`);
  jrActive.forEach((idx) => console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}`));

  console.log("Job Monitoring index migration completed successfully.");
}

// Standalone execution entrypoint
if (
  process.argv[1] &&
  process.argv[1].includes("migrateJobIndexes.js")
) {
  try {
    console.log(`Connecting to database: ${env.MONGO_URI ? "configured" : "missing"}`);
    await mongoose.connect(env.MONGO_URI);
    await migrateJobIndexes();
  } catch (err) {
    console.error("Migration failed:", err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}
