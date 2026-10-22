/**
 * Monitor routes
 *
 * POST   /api/monitors      — create (blocked once the caller's plan
 *                              monitor limit is reached — see
 *                              requireWithinLimit below)
 * GET    /api/monitors      — list (paginated, scoped to the caller)
 * GET    /api/monitors/:id  — get by id (scoped to the caller)
 * PUT    /api/monitors/:id  — update (scoped to the caller; interval
 *                              changes are re-checked against the plan's
 *                              minimum interval)
 * DELETE /api/monitors/:id  — delete (scoped to the caller)
 *
 * Authentication is enforced once at the mount point (routes/index.js).
 */

import { Router } from "express";
import {
  createMonitor,
  getMonitors,
  getMonitorById,
  getMonitorDiagnostics,
  manualHealthCheck,
  duplicateMonitor,
  updateMonitor,
  deleteMonitor,
} from "../controllers/monitor.controller.js";
import { validate, validateObjectId } from "../middlewares/validate.js";
import { requirePermission } from "../middlewares/permission.js";
import { requireWithinLimit } from "../middlewares/featureAccess.js";
import { getMonitorLimit } from "../utils/planUtils.js";
import { countOwnedMonitors } from "../services/monitor.service.js";
import {
  createMonitorSchema,
  updateMonitorSchema,
  listMonitorsSchema,
} from "../validators/monitor.validator.js";

const router = Router();

router.get(
  "/:id/diagnostics",
  requirePermission("monitor:read"),
  validateObjectId("id"),
  getMonitorDiagnostics,
);

router.post(
  "/:id/check",
  requirePermission("monitor:update"),
  validateObjectId("id"),
  manualHealthCheck,
);

router.post(
  "/:id/duplicate",
  requirePermission("monitor:create"),
  requireWithinLimit({
    limitFn: getMonitorLimit,
    countFn: (req) => countOwnedMonitors(req.user),
    resourceName: "monitor",
  }),
  validateObjectId("id"),
  validate(createMonitorSchema, "body"),
  duplicateMonitor,
);

router
  .route("/")
  .post(
    requirePermission("monitor:create"),
    requireWithinLimit({
      limitFn: getMonitorLimit,
      countFn: (req) => countOwnedMonitors(req.user),
      resourceName: "monitor",
    }),
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
