import asyncHandler from "../utils/asyncHandler.js";
import * as planService from "../services/plan.service.js";
import { sendSuccess } from "../utils/apiResponse.js";

// ── Controllers ──────────────────────────────────────────────────────────────

/**
 * GET /api/plans
 * Public plan catalog — pricing, limits, and feature copy for every tier.
 */
export const getPlans = asyncHandler(async (_req, res) => {
  const data = planService.getPlanCatalog();

  sendSuccess(res, { data });
});

/**
 * GET /api/plans/current
 * The caller's current plan, alongside its full definition.
 */
export const getCurrentPlan = asyncHandler(async (req, res) => {
  const data = planService.getCurrentPlanForUser(req.user);

  sendSuccess(res, { data });
});

/**
 * POST /api/plans/change
 * Upgrades or downgrades the caller's own plan. See plan.service.js for
 * the note on how this integrates with a future payment step.
 */
export const changePlan = asyncHandler(async (req, res) => {
  const { plan } = req.body;
  const userId = req.user.id || req.user._id;

  const { user, changeType } = await planService.changeUserPlan(
    userId,
    plan,
    req.user,
  );

  sendSuccess(res, {
    message:
      changeType === "upgrade"
        ? `Your plan has been upgraded to ${plan}.`
        : `Your plan has been downgraded to ${plan}.`,
    data: { user, changeType },
  });
});
