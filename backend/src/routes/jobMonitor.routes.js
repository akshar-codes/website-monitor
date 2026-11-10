import { Router } from "express";
import {
  createJobMonitor,
  getJobMonitors,
  getJobMonitorById,
  updateJobMonitor,
  deleteJobMonitor,
  rotateJobMonitorToken,
  toggleJobMonitorPause,
  getJobRuns,
} from "../controllers/jobMonitor.controller.js";
import { validate, validateObjectId } from "../middlewares/validate.js";
import { requirePermission } from "../middlewares/permission.js";
import {
  createJobMonitorSchema,
  updateJobMonitorSchema,
  listJobMonitorsSchema,
  listJobRunsSchema,
} from "../validators/jobMonitor.validator.js";

const router = Router();

router
  .route("/")
  .post(
    requirePermission("job-monitor:create"),
    validate(createJobMonitorSchema, "body"),
    createJobMonitor,
  )
  .get(
    requirePermission("job-monitor:read"),
    validate(listJobMonitorsSchema, "query"),
    getJobMonitors,
  );

router
  .route("/:id")
  .get(
    requirePermission("job-monitor:read"),
    validateObjectId("id"),
    getJobMonitorById,
  )
  .patch(
    requirePermission("job-monitor:update"),
    validateObjectId("id"),
    validate(updateJobMonitorSchema, "body"),
    updateJobMonitor,
  )
  .delete(
    requirePermission("job-monitor:delete"),
    validateObjectId("id"),
    deleteJobMonitor,
  );

router
  .route("/:id/rotate-token")
  .post(
    requirePermission("job-monitor:update"),
    validateObjectId("id"),
    rotateJobMonitorToken,
  );

router
  .route("/:id/pause")
  .patch(
    requirePermission("job-monitor:update"),
    validateObjectId("id"),
    toggleJobMonitorPause,
  );

router
  .route("/:id/runs")
  .get(
    requirePermission("job-monitor:read"),
    validateObjectId("id"),
    validate(listJobRunsSchema, "query"),
    getJobRuns,
  );

export default router;
