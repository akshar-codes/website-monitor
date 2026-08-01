/**
 * Activity routes
 *
 * GET /api/activity          — paginated, filterable, searchable activity history
 * GET /api/activity/summary  — recent activity + 30-day category breakdown
 *
 * Authentication is enforced at the mount point (routes/index.js);
 * "activity:read" is granted to every role (see config/permissions.js) but
 * is checked explicitly here for consistency with every other resource
 * router in the app (mirrors routes/usage.routes.js).
 *
 * There is deliberately no POST route — activity records are written
 * exclusively server-side via utils/activityLogger.js, never from client
 * input.
 */

import { Router } from "express";
import {
  getActivities,
  getRecentActivitySummary,
} from "../controllers/activity.controller.js";
import { validate } from "../middlewares/validate.js";
import { requirePermission } from "../middlewares/permission.js";
import {
  listActivitySchema,
  activitySummaryQuerySchema,
} from "../validators/activity.validator.js";

const router = Router();

// Before "/" so it never gets swallowed by any future :param route.
router.get(
  "/summary",
  requirePermission("activity:read"),
  validate(activitySummaryQuerySchema, "query"),
  getRecentActivitySummary,
);

router.get(
  "/",
  requirePermission("activity:read"),
  validate(listActivitySchema, "query"),
  getActivities,
);

export default router;
