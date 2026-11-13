import mongoose from "mongoose";
import logger from "../utils/logger.js";

/**
 * Drops the stale owner-wide unique idempotency indexes from the deploymentevents collection.
 *
 * Background: an earlier schema declared:
 *   { owner: 1, externalId: 1 }     unique
 *   { owner: 1, idempotencyKey: 1 } unique
 *
 * These indexes prevent two different deployment integrations belonging to the same
 * owner account from using the same externalId (e.g. two CI pipelines both sending
 * run-id "123").  They have been superseded by per-integration indexes:
 *   { owner: 1, integration: 1, externalId: 1 }     unique
 *   { owner: 1, integration: 1, idempotencyKey: 1 } unique
 *
 * Removing the declaration from the schema alone does NOT drop existing MongoDB
 * indexes.  This migration explicitly drops them so the new per-integration
 * constraints take effect without false duplicate-key errors.
 *
 * Returns { dropped: string[], skipped: string[], skippedReason: string }
 */
export const dropOwnerWideDeploymentIndexes = async (options = {}) => {
  if (mongoose.connection.readyState !== 1 && !options.force) {
    return {
      dropped: [],
      skipped: [],
      skippedReason: "MongoDB not connected",
    };
  }

  const db = mongoose.connection.db;
  if (!db && !options.collection) {
    return {
      dropped: [],
      skipped: [],
      skippedReason: "No active db handle",
    };
  }

  const collection = options.collection || db.collection("deploymentevents");

  // Retrieve current index list to avoid errors when dropping non-existent indexes
  let existingIndexes = [];
  try {
    existingIndexes = await collection.indexes();
  } catch (err) {
    // A fresh database may not have the collection yet, which means there
    // cannot be any legacy indexes to remove. The current schema indexes are
    // created immediately after this migration during startup.
    if (err.code === 26 || err.codeName === "NamespaceNotFound") {
      return { dropped: [], skipped: [] };
    }
    logger.error(
      `[dropOwnerWideDeploymentIndexes] Could not list indexes: ${err.message}`,
    );
    throw err;
  }

  const existingNames = new Set(existingIndexes.map((i) => i.name));

  // Names MongoDB assigns when no explicit name is given are derived from the key pattern.
  // These are the names the driver generates for the old declarations.
  const STALE_INDEX_NAMES = [
    "owner_1_externalId_1",
    "owner_1_idempotencyKey_1",
  ];

  const dropped = [];
  const skipped = [];

  for (const indexName of STALE_INDEX_NAMES) {
    if (!existingNames.has(indexName)) {
      skipped.push(indexName);
      logger.debug(
        `[dropOwnerWideDeploymentIndexes] Index "${indexName}" not found — skipping.`,
      );
      continue;
    }

    try {
      await collection.dropIndex(indexName);
      dropped.push(indexName);
      logger.info(
        `[dropOwnerWideDeploymentIndexes] Dropped stale index "${indexName}" from deploymentevents.`,
      );
    } catch (err) {
      // 27 = IndexNotFound; safe to ignore
      if (err.code === 27) {
        skipped.push(indexName);
      } else {
        logger.warn(
          `[dropOwnerWideDeploymentIndexes] Failed to drop index "${indexName}": ${err.message}`,
        );
        throw err; // Re-throw so startup can decide to fail safely
      }
    }
  }

  return { dropped, skipped };
};
