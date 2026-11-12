import apiClient from "./client.js";

/**
 * GET /api/monitors/:id/deployments
 * Retrieve deployment events for a specific monitor.
 */
export async function getMonitorDeployments(monitorId, params = {}) {
  const { data } = await apiClient.get(`/monitors/${monitorId}/deployments`, {
    params,
  });
  return data;
}

/**
 * GET /api/monitors/:id/deployments/:deploymentId
 * Retrieve a single deployment event for a specific monitor.
 */
export async function getMonitorDeploymentById(monitorId, deploymentId) {
  const { data } = await apiClient.get(
    `/monitors/${monitorId}/deployments/${deploymentId}`,
  );
  return data?.data;
}

/**
 * GET /api/monitors/:id/deployments/:deploymentId/impact
 * Retrieve performance impact analysis comparing before and after deployment.
 */
export async function getDeploymentImpact(
  monitorId,
  deploymentId,
  params = {},
) {
  const { data } = await apiClient.get(
    `/monitors/${monitorId}/deployments/${deploymentId}/impact`,
    { params },
  );
  return data?.data;
}

/**
 * GET /api/deployments/events
 * Retrieve general deployment events for user.
 */
export async function getDeployments(params = {}) {
  const { data } = await apiClient.get("/deployments/events", { params });
  return data;
}

/**
 * GET /api/deployments/integrations
 * Retrieve deployment integrations for user.
 */
export async function getDeploymentIntegrations() {
  const { data } = await apiClient.get("/deployments/integrations");
  return data?.data;
}
