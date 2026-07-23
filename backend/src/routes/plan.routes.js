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
  getCurrentPlan,
  changePlan,
} from "../controllers/plan.controller.js";
import { isAuthenticated } from "../middlewares/authenticate.js";
import { validate } from "../middlewares/validate.js";
import { changePlanSchema } from "../validators/plan.validator.js";

const router = Router();

router.get("/", getPlans);
router.get("/current", isAuthenticated, getCurrentPlan);
router.post(
  "/change",
  isAuthenticated,
  validate(changePlanSchema, "body"),
  changePlan,
);

export default router;
