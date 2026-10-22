import asyncHandler from "../utils/asyncHandler.js";
import * as monitorService from "../services/monitor.service.js";
import { sendSuccess, sendPaginated } from "../utils/apiResponse.js";
import { poll } from "../workers/poller.js";
import { classify } from "../workers/classifier.js";
import HealthCheck from "../models/HealthCheck.js";
import Monitor from "../models/Monitor.js";

// ── Controllers ──────────────────────────────────────────────────────────────

/**
 * POST /api/monitors
 * The monitor limit for the caller's plan is enforced upstream by
 * requireWithinLimit (see routes/monitor.routes.js) before this handler
 * ever runs.
 */
export const createMonitor = asyncHandler(async (req, res) => {
  const monitor = await monitorService.createMonitor(req.body, req.user);

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
  const result = await monitorService.getMonitors(query, req.user);

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
  const monitor = await monitorService.getMonitorById(req.params.id, req.user);

  sendSuccess(res, { data: monitor });
});

export const getMonitorDiagnostics = asyncHandler(async (req, res) => {
  const diagnostics = await monitorService.getMonitorDiagnostics(
    req.params.id,
    req.user,
  );
  sendSuccess(res, { data: diagnostics });
});

export const manualHealthCheck = asyncHandler(async (req, res) => {
  const monitor = await monitorService.getMonitorById(req.params.id, req.user);
  const result = await poll(monitor.url, { maxRetries: 0 });
  const classification = classify(result);
  const check = await HealthCheck.create({
    monitor: monitor._id,
    status: classification.status,
    frontendStatus: classification.frontendStatus,
    backendStatus: classification.backendStatus,
    databaseStatus: classification.databaseStatus,
    responseTime: result.responseTime,
    httpStatus: result.httpStatus,
    failureReason: classification.failureReason,
    rawResponse: result.body,
    diagnostics: result.diagnostics,
    checkedAt: new Date(),
  });
  await Monitor.findByIdAndUpdate(monitor._id, {
    lastCheckedAt: check.checkedAt,
  });
  sendSuccess(res, { message: "Manual health check completed", data: check });
});

export const duplicateMonitor = asyncHandler(async (req, res) => {
  const monitor = await monitorService.duplicateMonitor(
    req.params.id,
    req.body,
    req.user,
  );
  sendSuccess(res, {
    statusCode: 201,
    message: "Monitor duplicated successfully",
    data: monitor,
  });
});

/**
 * PUT /api/monitors/:id
 */
export const updateMonitor = asyncHandler(async (req, res) => {
  const monitor = await monitorService.updateMonitor(
    req.params.id,
    req.body,
    req.user,
  );

  sendSuccess(res, {
    message: "Monitor updated successfully",
    data: monitor,
  });
});

/**
 * DELETE /api/monitors/:id
 */
export const deleteMonitor = asyncHandler(async (req, res) => {
  await monitorService.deleteMonitor(req.params.id, req.user);

  sendSuccess(res, { message: "Monitor deleted successfully" });
});
