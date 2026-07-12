import asyncHandler from "../utils/asyncHandler.js";
import * as dashboardService from "../services/dashboard.service.js";
import { sendSuccess, sendPaginated } from "../utils/apiResponse.js";

// ── Controllers ──────────────────────────────────────────────────────────────

/**
 * GET /api/dashboard/overview
 * Main dashboard — everything in one round-trip.
 */
export const getOverview = asyncHandler(async (_req, res) => {
  const data = await dashboardService.getOverview();

  sendSuccess(res, { data });
});

/**
 * GET /api/dashboard/incidents
 * Paginated active incidents.
 */
export const getActiveIncidents = asyncHandler(async (req, res) => {
  const query = req.validatedQuery;
  const result = await dashboardService.getActiveIncidents(query);

  sendPaginated(res, {
    data: result.incidents,
    page: result.page,
    limit: query.limit,
    total: result.total,
  });
});

/**
 * GET /api/dashboard/health-checks
 * Recent health checks with optional filters.
 */
export const getRecentHealthChecks = asyncHandler(async (req, res) => {
  const checks = await dashboardService.getRecentHealthChecks(
    req.validatedQuery,
  );

  sendSuccess(res, { data: checks });
});

/**
 * GET /api/dashboard/monitors/:id/stats
 * Per-monitor detail page stats.
 */
export const getMonitorStats = asyncHandler(async (req, res) => {
  const data = await dashboardService.getMonitorStats(
    req.params.id,
    req.validatedQuery,
  );

  sendSuccess(res, { data });
});

/**
 * GET /api/dashboard/monitors/:id/chart-data
 * Per-monitor time-series chart data.
 */
export const getMonitorChartData = asyncHandler(async (req, res) => {
  const data = await dashboardService.getMonitorChartData(
    req.params.id,
    req.validatedQuery,
  );

  sendSuccess(res, { data });
});
