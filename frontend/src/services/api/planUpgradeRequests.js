import apiClient from "./client";

/**
 * POST /api/plan-upgrade-requests
 */
export async function requestPlanUpgrade(requestedPlan) {
  const { data } = await apiClient.post("/plan-upgrade-requests", {
    requestedPlan,
  });
  return data;
}

/**
 * GET /api/plan-upgrade-requests/mine
 */
export async function getMyPlanUpgradeRequests() {
  const { data } = await apiClient.get("/plan-upgrade-requests/mine");
  return data;
}
