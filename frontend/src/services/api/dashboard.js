import apiClient from "./client";

/**
 * GET /api/dashboard/overview
 */
export async function getOverview() {
  const { data } = await apiClient.get("/dashboard/overview");
  return data;
}

/**
 * GET /api/dashboard/summary
 */
export async function getDashboardSummary() {
  const { data } = await apiClient.get("/dashboard/summary");
  return data;
}

/**
 * GET /api/dashboard/incidents
 */
export async function getActiveIncidents(params = {}) {
  const { data } = await apiClient.get("/dashboard/incidents", { params });
  return data;
}

/**
 * GET /api/dashboard/health-checks
 */
export async function getRecentHealthChecks(params = {}) {
  const { data } = await apiClient.get("/dashboard/health-checks", { params });
  return data;
}

/**
 * GET /api/dashboard/monitors/:id/stats
 */
export async function getMonitorStats(id, params = {}) {
  const { data } = await apiClient.get(`/dashboard/monitors/${id}/stats`, {
    params,
  });
  return data;
}

/**
 * GET /api/dashboard/monitors/:id/chart-data
 */
export async function getMonitorChartData(id, params = {}) {
  const { data } = await apiClient.get(`/dashboard/monitors/${id}/chart-data`, {
    params,
  });
  return data;
}

/**
 * GET /api/dashboard/monitors/:id/details
 */
export async function getMonitorDetails(id, params = {}) {
  const { data } = await apiClient.get(`/dashboard/monitors/${id}/details`, {
    params,
  });
  return data;
}

/**
 * GET /api/dashboard/monitors/:id/analytics
 * `params` is either `{ window: "24h" | "7d" | "30d" }` or
 * `{ startDate: "YYYY-MM-DD", endDate: "YYYY-MM-DD" }` — never both (see
 * backend/src/validators/dashboard.validator.js#analyticsQuerySchema).
 */
export async function getMonitorAnalytics(id, params = {}) {
  const { data } = await apiClient.get(`/dashboard/monitors/${id}/analytics`, {
    params,
  });
  return data;
}
