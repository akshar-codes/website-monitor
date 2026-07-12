import asyncHandler from "../utils/asyncHandler.js";
import * as monitorService from "../services/monitor.service.js";
import { assertObjectId, validate } from "../utils/controllerHelpers.js";
import {
  createMonitorSchema,
  updateMonitorSchema,
  listMonitorsSchema,
} from "../validators/monitor.validator.js";

// ── Controllers ──────────────────────────────────────────────────────────────

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
