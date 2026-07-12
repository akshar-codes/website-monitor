import asyncHandler from "../utils/asyncHandler.js";
import * as dashboardService from "../services/dashboard.service.js";
import { assertObjectId, validate } from "../utils/controllerHelpers.js";
import {
  incidentsQuerySchema,
  healthChecksQuerySchema,
  monitorStatsQuerySchema,
} from "../validators/dashboard.validator.js";

// ── Controllers ──────────────────────────────────────────────────────────────

/**
 * GET /api/dashboard/overview
 * Main dashboard — everything in one round-trip.
 */
export const getOverview = asyncHandler(async (_req, res) => {
  const data = await dashboardService.getOverview();

  res.json({
    success: true,
    data,
  });
});

/**
 * GET /api/dashboard/incidents
 * Paginated active incidents.
 */
export const getActiveIncidents = asyncHandler(async (req, res) => {
  const query = validate(incidentsQuerySchema, req.query);
  const result = await dashboardService.getActiveIncidents(query);

  res.json({
    success: true,
    data: result.incidents,
    pagination: {
      total: result.total,
      page: result.page,
      totalPages: result.totalPages,
    },
  });
});

/**
 * GET /api/dashboard/health-checks
 * Recent health checks with optional filters.
 */
export const getRecentHealthChecks = asyncHandler(async (req, res) => {
  const query = validate(healthChecksQuerySchema, req.query);

  if (query.monitorId) {
    assertObjectId(query.monitorId);
  }

  const checks = await dashboardService.getRecentHealthChecks(query);

  res.json({
    success: true,
    data: checks,
  });
});

/**
 * GET /api/dashboard/monitors/:id/stats
 * Per-monitor detail page stats.
 */
export const getMonitorStats = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id);
  const query = validate(monitorStatsQuerySchema, req.query);
  const data = await dashboardService.getMonitorStats(req.params.id, query);

  res.json({
    success: true,
    data,
  });
});

/**
 * GET /api/dashboard/monitors/:id/chart-data
 * Per-monitor time-series chart data.
 */
export const getMonitorChartData = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id);
  const query = validate(monitorStatsQuerySchema, req.query);
  const data = await dashboardService.getMonitorChartData(
    req.params.id,
    query,
  );

  res.json({
    success: true,
    data,
  });
});
