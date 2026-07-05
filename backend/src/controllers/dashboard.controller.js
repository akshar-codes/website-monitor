const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const dashboardService = require("../services/dashboard.service");
const {
  incidentsQuerySchema,
  healthChecksQuerySchema,
  monitorStatsQuerySchema,
} = require("../validators/dashboard.validator");
const mongoose = require("mongoose");

// ── Helpers ──

/**
 * Validate that `id` is a valid Mongo ObjectId.
 */
const assertObjectId = (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw ApiError.badRequest(`Invalid ID format: ${id}`);
  }
};

/**
 * Parse a Zod schema and throw a 400 ApiError on failure.
 */
const validate = (schema, data) => {
  const result = schema.safeParse(data);
  if (!result.success) {
    const messages = result.error.errors.map((e) => e.message).join("; ");
    throw ApiError.badRequest(messages);
  }
  return result.data;
};

// ── Controllers ──

/**
 * GET /api/dashboard/overview
 * Main dashboard — everything in one round-trip.
 */
const getOverview = asyncHandler(async (_req, res) => {
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
const getActiveIncidents = asyncHandler(async (req, res) => {
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
const getRecentHealthChecks = asyncHandler(async (req, res) => {
  const query = validate(healthChecksQuerySchema, req.query);

  // Validate monitorId format if provided
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
const getMonitorStats = asyncHandler(async (req, res) => {
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
const getMonitorChartData = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id);
  const query = validate(monitorStatsQuerySchema, req.query);
  const data = await dashboardService.getMonitorChartData(req.params.id, query);

  res.json({
    success: true,
    data,
  });
});

module.exports = {
  getOverview,
  getActiveIncidents,
  getRecentHealthChecks,
  getMonitorStats,
  getMonitorChartData,
};
