import asyncHandler from "../utils/asyncHandler.js";
import * as planUpgradeRequestService from "../services/planUpgradeRequest.service.js";
import { sendSuccess } from "../utils/apiResponse.js";

// ── Controllers ──────────────────────────────────────────────────────────────

/**
 * POST /api/plan-upgrade-requests
 * Submits a manual upgrade request for admin review.
 */
export const createPlanUpgradeRequest = asyncHandler(async (req, res) => {
  const { requestedPlan } = req.body;
  const request = await planUpgradeRequestService.createUpgradeRequest(
    req.user,
    requestedPlan,
  );

  sendSuccess(res, {
    statusCode: 201,
    message:
      "Upgrade request submitted. An administrator will review it shortly.",
    data: request,
  });
});

/**
 * GET /api/plan-upgrade-requests/mine
 * The caller's currently pending request (if any) plus recent history.
 */
export const getMyPlanUpgradeRequests = asyncHandler(async (req, res) => {
  const data = await planUpgradeRequestService.getRequestsForUser(req.user);

  sendSuccess(res, { data });
});
