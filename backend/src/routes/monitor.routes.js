/**
 * Monitor routes
 *
 * POST   /api/monitors      — create
 * GET    /api/monitors      — list (paginated)
 * GET    /api/monitors/:id  — get by id
 * PUT    /api/monitors/:id  — update
 * DELETE /api/monitors/:id  — delete
 *
 * Authentication is enforced once at the mount point (routes/index.js).
 * Each handler below additionally declares the granular permission it
 * requires via requirePermission — see middlewares/permission.js and
 * config/permissions.js. Today every "user" role already holds every
 * monitor:* permission, so this is a non-breaking, purely declarative
 * addition; it's what lets a future restricted role (e.g. a read-only
 * "viewer") be introduced later with a one-line change to
 * config/permissions.js instead of touching route files.
 */

import { Router } from "express";
import {
  createMonitor,
  getMonitors,
  getMonitorById,
  updateMonitor,
  deleteMonitor,
} from "../controllers/monitor.controller.js";
import { validate, validateObjectId } from "../middlewares/validate.js";
import { requirePermission } from "../middlewares/permission.js";
import {
  createMonitorSchema,
  updateMonitorSchema,
  listMonitorsSchema,
} from "../validators/monitor.validator.js";

const router = Router();

router
  .route("/")
  .post(
    requirePermission("monitor:create"),
    validate(createMonitorSchema, "body"),
    createMonitor,
  )
  .get(
    requirePermission("monitor:read"),
    validate(listMonitorsSchema, "query"),
    getMonitors,
  );

router
  .route("/:id")
  .get(
    requirePermission("monitor:read"),
    validateObjectId("id"),
    getMonitorById,
  )
  .put(
    requirePermission("monitor:update"),
    validateObjectId("id"),
    validate(updateMonitorSchema, "body"),
    updateMonitor,
  )
  .delete(
    requirePermission("monitor:delete"),
    validateObjectId("id"),
    deleteMonitor,
  );

export default router;
