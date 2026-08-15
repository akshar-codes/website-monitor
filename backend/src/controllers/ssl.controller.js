import asyncHandler from "../utils/asyncHandler.js";
import * as sslService from "../services/ssl.service.js";
import { sendSuccess } from "../utils/apiResponse.js";

// ── Controllers ──────────────────────────────────────────────────────────────

/**
 * GET /api/ssl/overview
 * Aggregated SSL/domain status across every monitor the caller owns.
 */
export const getSslOverview = asyncHandler(async (req, res) => {
  const data = await sslService.getSslOverview(req.user);

  sendSuccess(res, { data });
});

/**
 * GET /api/ssl/monitors/:id
 * Certificate + domain detail for a single monitor.
 */
export const getMonitorSsl = asyncHandler(async (req, res) => {
  const data = await sslService.getMonitorSsl(req.params.id, req.user);

  sendSuccess(res, { data });
});

/**
 * POST /api/ssl/monitors/:id/check
 * Triggers an immediate, on-demand SSL/domain recheck.
 */
export const triggerSslCheck = asyncHandler(async (req, res) => {
  const data = await sslService.triggerManualCheck(req.params.id, req.user);

  sendSuccess(res, { message: "SSL check completed", data });
});

/**
 * PATCH /api/ssl/monitors/:id/settings
 * Enables or disables SSL monitoring for a single monitor.
 */
export const updateSslSettings = asyncHandler(async (req, res) => {
  const monitor = await sslService.updateSslMonitoringSetting(
    req.params.id,
    req.body.sslMonitoringEnabled,
    req.user,
  );

  sendSuccess(res, {
    message: `SSL monitoring ${req.body.sslMonitoringEnabled ? "enabled" : "disabled"}`,
    data: monitor,
  });
});
