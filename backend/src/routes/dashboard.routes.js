/**
 * Dashboard routes
 *
 * GET /api/dashboard/overview                  — main dashboard (aggregated)
 * GET /api/dashboard/incidents                 — active incidents (paginated)
 * GET /api/dashboard/health-checks             — recent checks (filterable)
 * GET /api/dashboard/monitors/:id/stats        — per-monitor detail stats
 * GET /api/dashboard/monitors/:id/chart-data   — per-monitor chart data
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
import {
  incidentsQuerySchema,
  healthChecksQuerySchema,
  monitorStatsQuerySchema,
} from "../validators/dashboard.validator.js";

const router = Router();

router.get("/overview", getOverview);

router.get(
  "/incidents",
  validate(incidentsQuerySchema, "query"),
  getActiveIncidents,
);

router.get(
  "/health-checks",
  validate(healthChecksQuerySchema, "query"),
  getRecentHealthChecks,
);

router.get(
  "/monitors/:id/stats",
  validateObjectId("id"),
  validate(monitorStatsQuerySchema, "query"),
  getMonitorStats,
);

router.get(
  "/monitors/:id/chart-data",
  validateObjectId("id"),
  validate(monitorStatsQuerySchema, "query"),
  getMonitorChartData,
);

export default router;
