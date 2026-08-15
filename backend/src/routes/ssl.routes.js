/**
 * SSL / domain monitoring routes
 *
 * GET   /api/ssl/overview              — aggregated SSL status across every owned monitor
 * GET   /api/ssl/monitors/:id          — certificate + domain detail for one monitor
 * POST  /api/ssl/monitors/:id/check    — trigger an on-demand recheck
 * PATCH /api/ssl/monitors/:id/settings — enable/disable SSL monitoring for one monitor
 *
 * Authentication is enforced at the mount point (routes/index.js). SSL
 * data is a facet of monitor ownership rather than its own resource
 * type, so this reuses the existing monitor:read / monitor:update
 * permissions instead of introducing a parallel permission namespace.
 */

import { Router } from "express";
import {
  getSslOverview,
  getMonitorSsl,
  triggerSslCheck,
  updateSslSettings,
} from "../controllers/ssl.controller.js";
import { validate, validateObjectId } from "../middlewares/validate.js";
import { requirePermission } from "../middlewares/permission.js";
import { updateSslSettingsSchema } from "../validators/ssl.validator.js";

const router = Router();

router.get("/overview", requirePermission("monitor:read"), getSslOverview);

router.get(
  "/monitors/:id",
  requirePermission("monitor:read"),
  validateObjectId("id"),
  getMonitorSsl,
);

router.post(
  "/monitors/:id/check",
  requirePermission("monitor:update"),
  validateObjectId("id"),
  triggerSslCheck,
);

router.patch(
  "/monitors/:id/settings",
  requirePermission("monitor:update"),
  validateObjectId("id"),
  validate(updateSslSettingsSchema, "body"),
  updateSslSettings,
);

export default router;
