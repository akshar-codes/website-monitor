import apiClient from "./client";

/**
 * GET /api/slos
 * List SLOs with pagination and optional filters.
 */
export async function getSlos(params = {}) {
  const { data } = await apiClient.get("/slos", { params });
  return data;
}

/**
 * GET /api/slos/:id
 * Fetch a single SLO by ID.
 */
export async function getSloById(id) {
  const { data } = await apiClient.get(`/slos/${id}`);
  return data?.data;
}

/**
 * POST /api/slos
 * Create a new Service Level Objective.
 */
export async function createSlo(payload) {
  const { data } = await apiClient.post("/slos", payload);
  return data?.data;
}

/**
 * PUT /api/slos/:id
 * Update an existing SLO.
 */
export async function updateSlo(id, payload) {
  const { data } = await apiClient.put(`/slos/${id}`, payload);
  return data?.data;
}

/**
 * DELETE /api/slos/:id
 * Delete an existing SLO.
 */
export async function deleteSlo(id) {
  const { data } = await apiClient.delete(`/slos/${id}`);
  return data;
}

/**
 * GET /api/slos?monitorId=:monitorId
 * Helper to retrieve SLOs configured for a specific monitor.
 */
export async function getMonitorSlos(monitorId, params = {}) {
  return getSlos({ ...params, monitorId });
}
