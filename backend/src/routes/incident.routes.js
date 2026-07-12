/**
 * Incident routes
 *
 * GET    /api/incidents                — list incidents (filtered, paginated)
 * GET    /api/incidents/downtime-stats — aggregate downtime statistics
 * GET    /api/incidents/:id            — single incident details
 * PATCH  /api/incidents/:id/status     — update incident status
 */

import { Router } from "express";
import {
  getIncidents,
  getIncidentById,
  updateIncidentStatus,
  getDowntimeStats,
} from "../controllers/incident.controller.js";
import { validate, validateObjectId } from "../middlewares/validate.js";
import {
  listIncidentsSchema,
  updateStatusSchema,
  downtimeStatsSchema,
} from "../validators/incident.validator.js";

const router = Router();

router.get("/", validate(listIncidentsSchema, "query"), getIncidents);
router.get(
  "/downtime-stats",
  validate(downtimeStatsSchema, "query"),
  getDowntimeStats,
); // before /:id to avoid param capture
router.get("/:id", validateObjectId("id"), getIncidentById);
router.patch(
  "/:id/status",
  validateObjectId("id"),
  validate(updateStatusSchema, "body"),
  updateIncidentStatus,
);

export default router;
