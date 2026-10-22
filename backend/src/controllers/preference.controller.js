import asyncHandler from "../utils/asyncHandler.js";
import * as preferenceService from "../services/preference.service.js";
import { sendSuccess } from "../utils/apiResponse.js";

// ── Controllers ──────────────────────────────────────────────────────────────

/**
 * GET /api/preferences
 * Returns the caller's preferences, creating a default document on first
 * access.
 */
export const getPreferences = asyncHandler(async (req, res) => {
  const data = await preferenceService.getPreferences(req.user);

  sendSuccess(res, { data });
});

/**
 * PUT /api/preferences
 * Partial update of theme, timezone, language, dateFormat, and/or
 * timeFormat.
 */
export const updatePreferences = asyncHandler(async (req, res) => {
  const data = await preferenceService.updatePreferences(req.user, req.body);

  sendSuccess(res, {
    message: "Preferences updated successfully",
    data,
  });
});

/**
 * PATCH /api/preferences/dashboard
 * Partial update of dashboard customization (widgets, widget order,
 * default time window, auto-refresh interval, compact mode).
 */
export const updateDashboardPreferences = asyncHandler(async (req, res) => {
  const data = await preferenceService.updateDashboardPreferences(
    req.user,
    req.body,
  );

  sendSuccess(res, {
    message: "Dashboard preferences updated successfully",
    data,
  });
});

export const updateNotificationPreferences = asyncHandler(async (req, res) => {
  const data = await preferenceService.updateNotificationPreferences(
    req.user,
    req.body,
  );
  sendSuccess(res, {
    message: "Notification preferences updated successfully",
    data,
  });
});

/**
 * POST /api/preferences/reset
 * Resets every preference field back to its schema default.
 */
export const resetPreferences = asyncHandler(async (req, res) => {
  const data = await preferenceService.resetPreferences(req.user);

  sendSuccess(res, {
    message: "Preferences reset to defaults",
    data,
  });
});
