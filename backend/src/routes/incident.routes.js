/**
 * Incident routes
 *
 * GET    /api/incidents                — list incidents (filtered, paginated)
 * GET    /api/incidents/downtime-stats — aggregate downtime statistics
 * GET    /api/incidents/:id            — single incident details
 * PATCH  /api/incidents/:id/status     — update incident status
 */

const { Router } = require("express");
const {
  getIncidents,
  getIncidentById,
  updateIncidentStatus,
  getDowntimeStats,
} = require("../controllers/incident.controller");

const router = Router();

router.get("/", getIncidents);
router.get("/downtime-stats", getDowntimeStats); // before /:id to avoid param capture
router.get("/:id", getIncidentById);
router.patch("/:id/status", updateIncidentStatus);

module.exports = router;
