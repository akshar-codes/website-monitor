import apiClient from "./client";

/**
 * GET /api/ssl/overview
 */
export async function getSslOverview() {
  const { data } = await apiClient.get("/ssl/overview");
  return data;
}

/**
 * GET /api/ssl/monitors/:id
 */
export async function getMonitorSsl(monitorId) {
  const { data } = await apiClient.get(`/ssl/monitors/${monitorId}`);
  return data;
}

/**
 * POST /api/ssl/monitors/:id/check
 */
export async function triggerSslCheck(monitorId) {
  const { data } = await apiClient.post(`/ssl/monitors/${monitorId}/check`);
  return data;
}

/**
 * PATCH /api/ssl/monitors/:id/settings
 */
export async function updateSslSettings(monitorId, sslMonitoringEnabled) {
  const { data } = await apiClient.patch(
    `/ssl/monitors/${monitorId}/settings`,
    {
      sslMonitoringEnabled,
    },
  );
  return data;
}
