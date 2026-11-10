import mongoose from "mongoose";
import JobMonitor from "../models/JobMonitor.js";
import ApiError from "../utils/ApiError.js";
import {
  hashJobToken,
  compareTokenHashes,
} from "../services/jobSchedule.service.js";

/**
 * Dedicated authentication middleware for external heartbeat reporting.
 *
 * Verifies that:
 * 1. The URL parameter `jobMonitorId` is a valid MongoDB ObjectId.
 * 2. A Bearer token is provided via the Authorization header or x-job-token.
 * 3. The token hash matches the JobMonitor's current tokenHash (or previousTokenHash during rotation).
 * 4. The JobMonitor is currently active and unpaused.
 *
 * Attaches the authenticated `jobMonitor` instance to `req.jobMonitor`.
 */
export const jobHeartbeatAuth = async (req, res, next) => {
  try {
    const { jobMonitorId } = req.params;

    if (!jobMonitorId || !mongoose.Types.ObjectId.isValid(jobMonitorId)) {
      throw ApiError.badRequest("Invalid job monitor ID format");
    }

    // ── Extract Token ──
    let rawToken = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      rawToken = authHeader.slice(7).trim();
    } else if (req.headers["x-job-token"]) {
      rawToken = String(req.headers["x-job-token"]).trim();
    }

    if (!rawToken) {
      throw ApiError.unauthorized(
        "Authentication token is required. Provide Authorization: Bearer <token> or x-job-token header.",
      );
    }

    // ── Safe Hash Comparison ──
    const candidateHash = hashJobToken(rawToken);

    const jobMonitor = await JobMonitor.findById(jobMonitorId).select(
      "+tokenHash +previousTokenHash",
    );

    if (!jobMonitor) {
      throw ApiError.notFound("Job monitor not found");
    }

    const matchesCurrent = compareTokenHashes(
      candidateHash,
      jobMonitor.tokenHash,
    );
    const matchesPrevious = jobMonitor.previousTokenHash
      ? compareTokenHashes(candidateHash, jobMonitor.previousTokenHash)
      : false;

    if (!matchesCurrent && !matchesPrevious) {
      throw ApiError.unauthorized("Invalid authentication token");
    }

    // ── Active State Verification ──
    if (jobMonitor.active === false || jobMonitor.status === "paused") {
      throw ApiError.conflict(
        "Job monitor is paused or inactive and cannot accept execution events",
      );
    }

    req.jobMonitor = jobMonitor;
    return next();
  } catch (error) {
    return next(error);
  }
};

export default jobHeartbeatAuth;
