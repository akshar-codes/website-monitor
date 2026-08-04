/**
 * Plan upgrade request routes (user-facing)
 *
 * POST /api/plan-upgrade-requests       — submit a manual upgrade request
 * GET  /api/plan-upgrade-requests/mine  — the caller's pending request + recent history
 *
 * Authentication is enforced at the mount point (routes/index.js). Admin
 * review endpoints (list/approve/reject) live under routes/admin.routes.js
 * since they require the admin role, already enforced at that router's
 * mount point.
 */

import { Router } from "express";
import {
  createPlanUpgradeRequest,
  getMyPlanUpgradeRequests,
} from "../controllers/planUpgradeRequest.controller.js";
import { validate } from "../middlewares/validate.js";
import { requirePermission } from "../middlewares/permission.js";
import { createPlanUpgradeRequestSchema } from "../validators/planUpgradeRequest.validator.js";

const router = Router();

router.post(
  "/",
  requirePermission("plan-upgrade-request:create"),
  validate(createPlanUpgradeRequestSchema, "body"),
  createPlanUpgradeRequest,
);

router.get(
  "/mine",
  requirePermission("plan-upgrade-request:read"),
  getMyPlanUpgradeRequests,
);

export default router;
