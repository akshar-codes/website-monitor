import apiClient from "./client";

/**
 * GET /api/activity
 * Supports pagination plus optional { category, action, search, window } filters.
 */
export async function getActivities(params = {}) {
  const { data } = await apiClient.get("/activity", { params });
  return data;
}

/**
 * GET /api/activity/summary
 */
export async function getActivitySummary(params = {}) {
  const { data } = await apiClient.get("/activity/summary", { params });
  return data;
}
