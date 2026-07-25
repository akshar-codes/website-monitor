import asyncHandler from "../utils/asyncHandler.js";
import * as usageService from "../services/usage.service.js";
import { sendSuccess } from "../utils/apiResponse.js";

/**
 * GET /api/usage
 * Returns the caller's current usage against their plan's limits —
 * monitor count/remaining, minimum check interval, data retention window,
 * team seat cap, and plan-gated feature flags.
 */
export const getUsage = asyncHandler(async (req, res) => {
  const data = await usageService.getUsageForUser(req.user);

  sendSuccess(res, { data });
});
