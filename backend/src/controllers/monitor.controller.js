import asyncHandler from "../utils/asyncHandler.js";
import * as monitorService from "../services/monitor.service.js";
import { sendSuccess, sendPaginated } from "../utils/apiResponse.js";

// ── Controllers ──────────────────────────────────────────────────────────────

/**
 * POST /api/monitors
 */
export const createMonitor = asyncHandler(async (req, res) => {
  const monitor = await monitorService.createMonitor(req.body);

  sendSuccess(res, {
    statusCode: 201,
    message: "Monitor created successfully",
    data: monitor,
  });
});

/**
 * GET /api/monitors
 */
export const getMonitors = asyncHandler(async (req, res) => {
  const query = req.validatedQuery;
  const result = await monitorService.getMonitors(query);

  sendPaginated(res, {
    data: result.monitors,
    page: result.page,
    limit: query.limit,
    total: result.total,
  });
});

/**
 * GET /api/monitors/:id
 */
export const getMonitorById = asyncHandler(async (req, res) => {
  const monitor = await monitorService.getMonitorById(req.params.id);

  sendSuccess(res, { data: monitor });
});

/**
 * PUT /api/monitors/:id
 */
export const updateMonitor = asyncHandler(async (req, res) => {
  const monitor = await monitorService.updateMonitor(req.params.id, req.body);

  sendSuccess(res, {
    message: "Monitor updated successfully",
    data: monitor,
  });
});

/**
 * DELETE /api/monitors/:id
 */
export const deleteMonitor = asyncHandler(async (req, res) => {
  await monitorService.deleteMonitor(req.params.id);

  sendSuccess(res, { message: "Monitor deleted successfully" });
});
