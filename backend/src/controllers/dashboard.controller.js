import asyncHandler from "../utils/asyncHandler.js";
import * as dashboardService from "../services/dashboard.service.js";
import { sendSuccess, sendPaginated } from "../utils/apiResponse.js";

// ── Controllers ──────────────────────────────────────────────────────────────

/**
 * GET /api/dashboard/overview
 * Main dashboard — everything in one round-trip, scoped to the caller's
 * own monitors.
 */
export const getOverview = asyncHandler(async (req, res) => {
  const data = await dashboardService.getOverview(req.user);

  sendSuccess(res, { data });
});

/**
 * GET /api/dashboard/summary
 */
export const getDashboardSummary = asyncHandler(async (req, res) => {
  const data = await dashboardService.getDashboardSummary(req.user);

  sendSuccess(res, { data });
});

/**
 * GET /api/dashboard/incidents
 * Paginated active incidents, scoped to the caller.
 */
export const getActiveIncidents = asyncHandler(async (req, res) => {
  const query = req.validatedQuery;
  const result = await dashboardService.getActiveIncidents(query, req.user);

  sendPaginated(res, {
    data: result.incidents,
    page: result.page,
    limit: query.limit,
    total: result.total,
  });
});

/**
 * GET /api/dashboard/health-checks
 * Recent health checks with optional filters, scoped to the caller.
 */
export const getRecentHealthChecks = asyncHandler(async (req, res) => {
  const checks = await dashboardService.getRecentHealthChecks(
    req.validatedQuery,
    req.user,
  );

  sendSuccess(res, { data: checks });
});

/**
 * GET /api/dashboard/monitors/:id/stats
 * Per-monitor detail page stats. 404s if the monitor isn't owned by the
 * caller.
 */
export const getMonitorStats = asyncHandler(async (req, res) => {
  const data = await dashboardService.getMonitorStats(
    req.params.id,
    req.validatedQuery,
    req.user,
  );

  sendSuccess(res, { data });
});

/**
 * GET /api/dashboard/monitors/:id/chart-data
 * Per-monitor time-series chart data. 404s if the monitor isn't owned by
 * the caller.
 */
export const getMonitorChartData = asyncHandler(async (req, res) => {
  const data = await dashboardService.getMonitorChartData(
    req.params.id,
    req.validatedQuery,
    req.user,
  );

  sendSuccess(res, { data });
});

/**
 * GET /api/dashboard/monitors/:id/details
 */
export const getMonitorDetails = asyncHandler(async (req, res) => {
  const data = await dashboardService.getMonitorDetails(
    req.params.id,
    req.validatedQuery,
    req.user,
  );

  sendSuccess(res, { data });
});

/**
 * GET /api/dashboard/monitors/:id/analytics
 * Monitor analytics / performance insights — uptime
 */
export const getMonitorAnalytics = asyncHandler(async (req, res) => {
  const data = await dashboardService.getMonitorAnalytics(
    req.params.id,
    req.validatedQuery,
    req.user,
  );

  sendSuccess(res, { data });
});

export const getMonitorRegionalAnalytics = asyncHandler(async (req, res) => {
  const data = await dashboardService.getMonitorRegionalAnalytics(
    req.params.id,
    req.validatedQuery,
    req.user,
  );
  sendSuccess(res, { data });
});
