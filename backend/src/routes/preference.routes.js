/**
 * Preference routes
 *
 * GET   /api/preferences           — the caller's preferences (auto-created on first access)
 * PUT   /api/preferences           — update general preferences (theme, timezone, language, formats)
 * PATCH /api/preferences/dashboard — update dashboard customization
 * POST  /api/preferences/reset     — reset every preference to its default
 *
 * Authentication is enforced once at the mount point (routes/index.js).
 * No additional permission check is applied — preferences are always the
 * caller's own personal settings, never another user's, so there is
 * nothing here for a role/permission layer to gate (mirrors
 * routes/profile.routes.js's authenticated routes).
 */

import { Router } from "express";
import {
  getPreferences,
  updatePreferences,
  updateDashboardPreferences,
  updateNotificationPreferences,
  resetPreferences,
} from "../controllers/preference.controller.js";
import { validate } from "../middlewares/validate.js";
import {
  updatePreferencesSchema,
  updateDashboardPreferencesSchema,
  updateNotificationPreferencesSchema,
} from "../validators/preference.validator.js";

const router = Router();

router.get("/", getPreferences);

router.put("/", validate(updatePreferencesSchema, "body"), updatePreferences);

router.patch(
  "/dashboard",
  validate(updateDashboardPreferencesSchema, "body"),
  updateDashboardPreferences,
);

router.patch(
  "/notifications",
  validate(updateNotificationPreferencesSchema, "body"),
  updateNotificationPreferences,
);

router.post("/reset", resetPreferences);

export default router;
