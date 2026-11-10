import asyncHandler from "../utils/asyncHandler.js";
import * as jobHeartbeatService from "../services/jobHeartbeat.service.js";
import { sendSuccess } from "../utils/apiResponse.js";

/**
 * POST /api/job-heartbeats/:jobMonitorId
 * Ingest external heartbeat execution report (started, succeeded, failed).
 * Protected by jobHeartbeatAuth and heartbeatRateLimiter.
 */
export const reportHeartbeat = asyncHandler(async (req, res) => {
  const jobMonitor = req.jobMonitor;
  const payload = req.body;
  const reqContext = {
    clientIp: req.ip,
    userAgent: req.headers["user-agent"] || null,
  };

  const result = await jobHeartbeatService.processHeartbeat(
    jobMonitor,
    payload,
    reqContext,
  );

  const statusCode = result.duplicate
    ? 200
    : payload.event === "started"
      ? 201
      : 200;

  sendSuccess(res, {
    statusCode,
    message: result.duplicate
      ? result.message
      : `Heartbeat event "${payload.event}" processed successfully`,
    data: result,
  });
});
