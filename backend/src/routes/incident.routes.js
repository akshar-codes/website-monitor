/**
 * Incident routes
 *
 * GET    /api/incidents                — list incidents (filtered, paginated)
 * GET    /api/incidents/downtime-stats — aggregate downtime statistics
 * GET    /api/incidents/:id            — single incident details
 * PATCH  /api/incidents/:id/status     — update incident status
 *
 * Authentication is enforced once at the mount point (routes/index.js).
 * Every route below additionally requires the relevant permission (see
 * config/permissions.js), and downtime-stats enforces the caller's plan
 * data-retention limit via requireWindowWithinRetention.
 */

import { Router } from "express";
import {
  getIncidents,
  getIncidentById,
  updateIncidentStatus,
  getDowntimeStats,
} from "../controllers/incident.controller.js";
import { validate, validateObjectId } from "../middlewares/validate.js";
import { requirePermission } from "../middlewares/permission.js";
import { requireWindowWithinRetention } from "../middlewares/featureAccess.js";
import {
  listIncidentsSchema,
  updateStatusSchema,
  downtimeStatsSchema,
} from "../validators/incident.validator.js";

const router = Router();

router.get(
  "/",
  requirePermission("incident:read"),
  validate(listIncidentsSchema, "query"),
  getIncidents,
);
router.get(
  "/downtime-stats",
  requirePermission("incident:read"),
  validate(downtimeStatsSchema, "query"),
  requireWindowWithinRetention,
  getDowntimeStats,
); // before /:id to avoid param capture
router.get(
  "/:id",
  requirePermission("incident:read"),
  validateObjectId("id"),
  getIncidentById,
);
router.patch(
  "/:id/status",
  requirePermission("incident:update"),
  validateObjectId("id"),
  validate(updateStatusSchema, "body"),
  updateIncidentStatus,
);

export default router;
