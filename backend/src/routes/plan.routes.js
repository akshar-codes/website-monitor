/**
 * Subscription plan routes
 *
 * GET  /api/plans          — public plan catalog (pricing, limits, features)
 * GET  /api/plans/current  — the caller's current plan + full definition
 * POST /api/plans/change   — upgrade or downgrade the caller's plan
 */

import { Router } from "express";
import {
  getPlans,
  getBillingMode,
  getCurrentPlan,
  changePlan,
} from "../controllers/plan.controller.js";
import { isAuthenticated } from "../middlewares/authenticate.js";
import { requirePermission } from "../middlewares/permission.js";
import { validate } from "../middlewares/validate.js";
import { changePlanSchema } from "../validators/plan.validator.js";

const router = Router();

router.get("/", getPlans);
router.get("/billing-mode", getBillingMode);
router.get(
  "/current",
  isAuthenticated,
  requirePermission("plan:read"),
  getCurrentPlan,
);
router.post(
  "/change",
  isAuthenticated,
  requirePermission("plan:change"),
  validate(changePlanSchema, "body"),
  changePlan,
);

export default router;
