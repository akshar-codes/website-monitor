import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import monitorService from "../services/monitor.service.js";
import {
  createMonitorSchema,
  updateMonitorSchema,
  listMonitorsSchema,
} from "../validators/monitor.validator.js";
import mongoose from "mongoose";

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
export const createMonitor = asyncHandler(async (req, res) => {
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
export const getMonitors = asyncHandler(async (req, res) => {
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
export const getMonitorById = asyncHandler(async (req, res) => {
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
export const updateMonitor = asyncHandler(async (req, res) => {
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
export const deleteMonitor = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id);
  await monitorService.deleteMonitor(req.params.id);

  res.json({
    success: true,
    message: "Monitor deleted successfully",
  });
});
