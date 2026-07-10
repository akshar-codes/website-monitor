import apiClient from "./client";

/**
 * GET /api/incidents
 */
export async function getIncidents(params = {}) {
  const { data } = await apiClient.get("/incidents", { params });
  return data;
}

/**
 * GET /api/incidents/:id
 */
export async function getIncidentById(id) {
  const { data } = await apiClient.get(`/incidents/${id}`);
  return data;
}

/**
 * PATCH /api/incidents/:id/status
 */
export async function updateIncidentStatus(id, payload) {
  const { data } = await apiClient.patch(`/incidents/${id}/status`, payload);
  return data;
}

/**
 * GET /api/incidents/downtime-stats
 */
export async function getDowntimeStats(params = {}) {
  const { data } = await apiClient.get("/incidents/downtime-stats", { params });
  return data;
}
