/**
 * MongoDB connection via Mongoose
 */

import mongoose from "mongoose";
import env from "./env.js";
import logger from "../utils/logger.js";
import { maskConnectionString } from "../utils/sanitizeLogData.js";
import { dropOwnerWideDeploymentIndexes } from "../migrations/dropOwnerWideDeploymentIndexes.js";
import { reconcileDeploymentAlertDuplicates } from "../migrations/reconcileDeploymentAlertDuplicates.js";
import DeploymentEvent from "../models/DeploymentEvent.js";
import DeploymentAlertState from "../models/DeploymentAlertState.js";

// Mongoose propagates the active transaction session to model operations
// inside connection.transaction(). Keep multi-document state transitions
// atomic without threading a session through every service call.
mongoose.set("transactionAsyncLocalStorage", true);

const connectDB = async () => {
  logger.info(`Connecting to MongoDB: ${maskConnectionString(env.MONGO_URI)}`);

  try {
    const conn = await mongoose.connect(env.MONGO_URI);
    logger.info(
      `MongoDB connected: ${conn.connection.host}/${conn.connection.name}`,
    );

    // ── P1 Migration: Drop stale owner-wide unique indexes that contradict
    //   per-integration idempotency scoping.  Must complete before Mongoose
    //   syncs model indexes so the new per-integration constraints are applied
    //   cleanly without duplicate-key conflicts on existing collections.
    const staleIndexResult = await dropOwnerWideDeploymentIndexes();
    if (staleIndexResult.skippedReason) {
      throw new Error(
        `Stale deployment index migration did not complete: ${staleIndexResult.skippedReason}`,
      );
    }
    // Create the schema's current indexes after dropping incompatible legacy
    // constraints, then verify both obsolete and required indexes explicitly.
    await DeploymentEvent.createIndexes();
    const deploymentIndexes = await DeploymentEvent.collection.indexes();
    const staleNames = new Set([
      "owner_1_externalId_1",
      "owner_1_idempotencyKey_1",
    ]);
    if (deploymentIndexes.some((index) => staleNames.has(index.name))) {
      throw new Error("Owner-wide deployment idempotency index still exists");
    }
    for (const name of [
      "owner_integration_externalId",
      "owner_integration_idempotencyKey",
    ]) {
      if (
        !deploymentIndexes.some((index) => index.name === name && index.unique)
      ) {
        throw new Error(`Required deployment index ${name} is missing`);
      }
    }
    logger.info(
      "Stale owner-wide deployment event indexes migration completed.",
    );

    // ── P2 Migration: Reconcile duplicate DeploymentAlertState documents and
    //   create the compound unique (deployment, monitor) index.
    //   This migration MUST succeed before the application is considered ready,
    //   because duplicate alert records break the notification deduplication
    //   and concurrent dispatch protection.
    const reconcileResult = await reconcileDeploymentAlertDuplicates();

    if (reconcileResult.skipped) {
      throw new Error("Deployment alert reconciliation was skipped");
    }
    const alertIndexes = await DeploymentAlertState.collection.indexes();
    const alertUniqueIndex = alertIndexes.find(
      (index) =>
        index.key?.deployment === 1 &&
        index.key?.monitor === 1 &&
        index.unique === true,
    );
    if (!alertUniqueIndex) {
      throw new Error("Required unique deployment alert index is missing");
    }
    logger.info(
      `DeploymentAlertState reconciliation completed: ` +
        `${reconcileResult.reconciledGroups} group(s) merged, ` +
        `${reconcileResult.deletedDuplicates} duplicate(s) removed.`,
    );
  } catch (error) {
    // Any migration or connection failure is fatal — the application must not
    // start in a partially-migrated state where duplicate events or stale
    // indexes can corrupt idempotency guarantees.
    logger.error(`MongoDB startup error: ${error.message}`, {
      stack: error.stack,
    });
    process.exit(1);
  }
};

// ── Connection lifecycle logging ──
// Registered once at module load — covers the initial connection as well
// as any reconnects Mongoose performs automatically afterwards.

mongoose.connection.on("connecting", () => {
  logger.debug("MongoDB connecting…");
});

mongoose.connection.on("connected", () => {
  logger.debug("MongoDB connection established");
});

mongoose.connection.on("disconnected", () => {
  logger.warn("MongoDB disconnected");
});

mongoose.connection.on("reconnected", () => {
  logger.info("MongoDB reconnected");
});

mongoose.connection.on("error", (error) => {
  logger.error(`MongoDB connection error: ${error.message}`, {
    stack: error.stack,
  });
});

export default connectDB;
