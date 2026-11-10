import mongoose from "mongoose";
import Incident from "../src/models/Incident.js";
import env from "../src/config/env.js";

/**
 * Migrates Incident indexes to support both Monitor and JobMonitor resources.
 * Specifically replaces the legacy unique active-incident index on { monitor: 1 }
 * with an updated partial unique index that restricts to documents where monitor exists,
 * allowing job monitor incidents to be tracked without index collision.
 */
export async function migrateActiveIncidentIndex() {
  const collection = Incident.collection;
  try {
    const indexes = await collection.indexes();
    for (const idx of indexes) {
      const isMonitorIndex = idx.key?.monitor === 1 && !idx.key?.startedAt;
      const hasLegacyPartialFilter =
        idx.unique &&
        idx.partialFilterExpression?.status &&
        !idx.partialFilterExpression?.monitor;

      if (isMonitorIndex && hasLegacyPartialFilter) {
        console.log(`Dropping legacy active incident index: ${idx.name}`);
        await collection.dropIndex(idx.name);
        console.log(`Dropped index: ${idx.name}`);
      }
    }

    console.log("Synchronizing new Incident indexes...");
    await Incident.syncIndexes();
    console.log("Incident index migration completed successfully.");
  } catch (error) {
    console.error("Incident index migration failed:", error.message);
    throw error;
  }
}

// Standalone execution entrypoint
if (
  process.argv[1] &&
  process.argv[1].includes("migrateActiveIncidentIndex.js")
) {
  try {
    await mongoose.connect(env.MONGO_URI);
    await migrateActiveIncidentIndex();
  } catch (err) {
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}
