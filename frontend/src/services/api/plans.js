import apiClient from "./client";

/**
 * GET /api/plans
 */
export async function getPlanCatalog() {
  const { data } = await apiClient.get("/plans");
  return data;
}

/**
 * GET /api/plans/current
 */
export async function getCurrentPlan() {
  const { data } = await apiClient.get("/plans/current");
  return data;
}

/**
 * POST /api/plans/change
 */
export async function changePlan(plan) {
  const { data } = await apiClient.post("/plans/change", { plan });
  return data;
}
