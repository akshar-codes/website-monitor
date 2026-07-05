const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const monitorService = require("../services/monitor.service");
const {
  createMonitorSchema,
  updateMonitorSchema,
  listMonitorsSchema,
} = require("../validators/monitor.validator");
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
 * POST /api/monitors
 */
const createMonitor = asyncHandler(async (req, res) => {
  const data = validate(createMonitorSchema, req.body);
  const monitor = await monitorService.createMonitor(data);

  res.status(201).json({
    success: true,
    data: monitor,
  });
});

/**
 * GET /api/monitors
 */
const getMonitors = asyncHandler(async (req, res) => {
  const query = validate(listMonitorsSchema, req.query);
  const result = await monitorService.getMonitors(query);

  res.json({
    success: true,
    data: result.monitors,
    pagination: {
      total: result.total,
      page: result.page,
      totalPages: result.totalPages,
    },
  });
});

/**
 * GET /api/monitors/:id
 */
const getMonitorById = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id);
  const monitor = await monitorService.getMonitorById(req.params.id);

  res.json({
    success: true,
    data: monitor,
  });
});

/**
 * PUT /api/monitors/:id
 */
const updateMonitor = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id);
  const data = validate(updateMonitorSchema, req.body);
  const monitor = await monitorService.updateMonitor(req.params.id, data);

  res.json({
    success: true,
    data: monitor,
  });
});

/**
 * DELETE /api/monitors/:id
 */
const deleteMonitor = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id);
  await monitorService.deleteMonitor(req.params.id);

  res.json({
    success: true,
    message: "Monitor deleted successfully",
  });
});

module.exports = {
  createMonitor,
  getMonitors,
  getMonitorById,
  updateMonitor,
  deleteMonitor,
};
