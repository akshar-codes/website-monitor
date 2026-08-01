import asyncHandler from "../utils/asyncHandler.js";
import * as activityService from "../services/activity.service.js";
import { sendSuccess, sendPaginated } from "../utils/apiResponse.js";

// ── Controllers ──────────────────────────────────────────────────────────────

/**
 * GET /api/activity
 * Paginated, filterable, searchable activity history — scoped to the
 * caller. No route exists to create an activity record: writes only ever
 * happen server-side via utils/activityLogger.js.
 */
export const getActivities = asyncHandler(async (req, res) => {
  const query = req.validatedQuery;
  const result = await activityService.getActivities(query, req.user);

  sendPaginated(res, {
    data: result.activities,
    page: result.page,
    limit: query.limit,
    total: result.total,
  });
});

/**
 * GET /api/activity/summary
 * Recent activity + a 30-day category breakdown, scoped to the caller.
 */
export const getRecentActivitySummary = asyncHandler(async (req, res) => {
  const { limit } = req.validatedQuery;
  const data = await activityService.getRecentActivitySummary(req.user, {
    limit,
  });

  sendSuccess(res, { data });
});
