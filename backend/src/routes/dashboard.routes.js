/**
 * Dashboard routes
 *
 * GET /api/dashboard/overview                  — main dashboard (aggregated)
 * GET /api/dashboard/incidents                 — active incidents (paginated)
 * GET /api/dashboard/health-checks             — recent checks (filterable)
 * GET /api/dashboard/monitors/:id/stats        — per-monitor detail stats
 * GET /api/dashboard/monitors/:id/chart-data   — per-monitor chart data
 *
 * Authentication is enforced once at the mount point (routes/index.js).
 * Every route below additionally requires the relevant permission (see
 * config/permissions.js), and the two window-based endpoints enforce the
 * caller's plan data-retention limit via requireWindowWithinRetention.
 */

import { Router } from "express";
import {
  getOverview,
  getActiveIncidents,
  getRecentHealthChecks,
  getMonitorStats,
  getMonitorChartData,
} from "../controllers/dashboard.controller.js";
import { validate, validateObjectId } from "../middlewares/validate.js";
import { requirePermission } from "../middlewares/permission.js";
import { requireWindowWithinRetention } from "../middlewares/featureAccess.js";
import {
  incidentsQuerySchema,
  healthChecksQuerySchema,
  monitorStatsQuerySchema,
} from "../validators/dashboard.validator.js";

const router = Router();

router.get("/overview", requirePermission("monitor:read"), getOverview);

router.get(
  "/incidents",
  requirePermission("incident:read"),
  validate(incidentsQuerySchema, "query"),
  getActiveIncidents,
);

router.get(
  "/health-checks",
  requirePermission("monitor:read"),
  validate(healthChecksQuerySchema, "query"),
  getRecentHealthChecks,
);

router.get(
  "/monitors/:id/stats",
  requirePermission("monitor:read"),
  validateObjectId("id"),
  validate(monitorStatsQuerySchema, "query"),
  requireWindowWithinRetention,
  getMonitorStats,
);

router.get(
  "/monitors/:id/chart-data",
  requirePermission("monitor:read"),
  validateObjectId("id"),
  validate(monitorStatsQuerySchema, "query"),
  requireWindowWithinRetention,
  getMonitorChartData,
);

export default router;
