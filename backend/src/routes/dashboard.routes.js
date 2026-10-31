/**
 * Dashboard routes
 *
 * GET /api/dashboard/overview                  — main dashboard (aggregated)
 * GET /api/dashboard/summary                    — full dashboard page payload
 *                                                  (overview + monitor status
 *                                                  grid + system-wide chart,
 *                                                  all in one request)
 * GET /api/dashboard/incidents                 — active incidents (paginated)
 * GET /api/dashboard/health-checks             — recent checks (filterable)
 * GET /api/dashboard/monitors/:id/stats        — per-monitor detail stats
 * GET /api/dashboard/monitors/:id/chart-data   — per-monitor chart data
 * GET /api/dashboard/monitors/:id/details      — combined Monitor Details
 *                                                  page payload (stats +
 *                                                  chart data in one request)
 * GET /api/dashboard/monitors/:id/analytics    — monitor analytics /
 *                                                  performance insights,
 *                                                  window preset OR custom
 *                                                  startDate/endDate range
 */

import { Router } from "express";
import {
  getOverview,
  getDashboardSummary,
  getActiveIncidents,
  getRecentHealthChecks,
  getMonitorStats,
  getMonitorChartData,
  getMonitorDetails,
  getMonitorAnalytics,
  getMonitorRegionalAnalytics,
} from "../controllers/dashboard.controller.js";
import { validate, validateObjectId } from "../middlewares/validate.js";
import { requirePermission } from "../middlewares/permission.js";
import {
  requireWindowWithinRetention,
  requireAnalyticsRangeWithinRetention,
} from "../middlewares/featureAccess.js";
import {
  incidentsQuerySchema,
  healthChecksQuerySchema,
  monitorStatsQuerySchema,
  analyticsQuerySchema,
} from "../validators/dashboard.validator.js";

const router = Router();

router.get("/overview", requirePermission("monitor:read"), getOverview);

router.get("/summary", requirePermission("monitor:read"), getDashboardSummary);

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

router.get(
  "/monitors/:id/details",
  requirePermission("monitor:read"),
  validateObjectId("id"),
  validate(monitorStatsQuerySchema, "query"),
  requireWindowWithinRetention,
  getMonitorDetails,
);

// Before-vs-after position relative to /details doesn't matter (Express
// matches literal "analytics" vs. the earlier routes' literal segments,
// none of which collide with a :id param here) — kept last simply to
// group it after the other per-monitor detail endpoints.
router.get(
  "/monitors/:id/regions",
  requirePermission("monitor:read"),
  validateObjectId("id"),
  validate(monitorStatsQuerySchema, "query"),
  requireWindowWithinRetention,
  getMonitorRegionalAnalytics,
);

router.get(
  "/monitors/:id/analytics",
  requirePermission("monitor:read"),
  validateObjectId("id"),
  validate(analyticsQuerySchema, "query"),
  requireAnalyticsRangeWithinRetention,
  getMonitorAnalytics,
);

export default router;
