import { Router } from "express";
import { reportHeartbeat } from "../controllers/jobHeartbeat.controller.js";
import { jobHeartbeatAuth } from "../middlewares/jobHeartbeatAuth.js";
import { heartbeatRateLimiter } from "../middlewares/rateLimiter.js";
import { validate } from "../middlewares/validate.js";
import { jobHeartbeatSchema } from "../validators/jobHeartbeat.validator.js";

const router = Router();

/**
 * POST /api/job-heartbeats/:jobMonitorId
 * Ingest external execution events (started, succeeded, failed).
 */
router.post(
  "/:jobMonitorId",
  heartbeatRateLimiter,
  jobHeartbeatAuth,
  validate(jobHeartbeatSchema, "body"),
  reportHeartbeat,
);

export default router;
