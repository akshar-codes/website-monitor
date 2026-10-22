import Activity from "../models/Activity.js";
import logger from "./logger.js";
import {
  redactActivityText,
  sanitizeActivityMetadata,
} from "./activityRedaction.js";

/**
 * Reusable activity-logging entry point — the ONLY place Activity
 * documents are created in the codebase. Every domain service
 * (monitor.service.js, incident.service.js, plan.service.js,
 * admin.service.js, profile.service.js) and auth.controller.js calls
 * this instead of writing to the Activity model directly, so:
 *   - the write shape (redaction, field defaults) lives in one place
 *   - a logging failure can never break the feature that triggered it
 *
 * Deliberately fire-and-forget from the caller's perspective in effect
 * (never throws), but still awaited internally so the write actually
 * completes before the request finishes — losing activity entries
 * silently under load would defeat the point of an audit trail.
 *
 * @param {object} params
 * @param {string|import("mongoose").Types.ObjectId} params.userId — whose activity log this belongs to
 * @param {string} params.category — see config/activityConstants.js#ACTIVITY_CATEGORIES
 * @param {string} params.action — see config/activityConstants.js#ACTIVITY_ACTIONS
 * @param {string} params.description — pre-rendered, human-readable sentence
 * @param {string} [params.entityType] — e.g. "Monitor", "Incident", "User"
 * @param {string|import("mongoose").Types.ObjectId} [params.entityId]
 * @param {object} [params.metadata] — small structured context (no secrets/PII)
 * @param {import("express").Request} [params.req] — source of ip/userAgent, when available
 */
export const logActivity = async ({
  userId,
  category,
  action,
  description,
  entityType = null,
  entityId = null,
  metadata = null,
  outcome = "success",
  req = null,
}) => {
  if (!userId || !category || !action || !description) {
    logger.warn(
      "logActivity called with missing required fields — skipping write",
      { category, action },
    );
    return;
  }

  try {
    await Activity.create({
      user: userId,
      category,
      action,
      description: redactActivityText(description),
      outcome: outcome === "failure" ? "failure" : "success",
      entityType,
      entityId,
      metadata: sanitizeActivityMetadata(metadata),
      // Network/session fingerprints belong in the dedicated Session model;
      // the activity trail keeps action context without duplicating them.
      ip: null,
      userAgent: null,
    });
  } catch (error) {
    // Never let an activity-log failure surface to the caller — it must
    // not fail the request that triggered it (mirrors the
    // sendPasswordChangedEmail best-effort pattern in auth.service.js).
    logger.error(
      `Failed to log activity (${category}/${action}) for user ${userId}: ${error.message}`,
      { stack: error.stack },
    );
  }
};

export default logActivity;
