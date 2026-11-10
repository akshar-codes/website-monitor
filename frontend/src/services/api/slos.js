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

/**
 * POST /api/slos/:id/evaluate
 * Trigger on-demand evaluation of an SLO.
 */
export async function triggerSloEvaluation(id) {
  const { data } = await apiClient.post(`/slos/${id}/evaluate`);
  return data?.data;
}

/**
 * GET /api/slos/:id/snapshots
 * Retrieve paginated historical snapshots for an SLO.
 */
export async function getSloSnapshots(id, params = {}) {
  const { data } = await apiClient.get(`/slos/${id}/snapshots`, { params });
  return data;
}

/**
 * GET /api/slos/:id/latest
 * Fetch the latest evaluation snapshot for an SLO.
 */
export async function getLatestSloSnapshot(id) {
  const { data } = await apiClient.get(`/slos/${id}/latest`);
  return data?.data;
}

/**
 * GET /api/slos/:id/alert-state
 * Fetch the current persistent alert state for an SLO.
 */
export async function getSloAlertState(id) {
  const { data } = await apiClient.get(`/slos/${id}/alert-state`);
  return data?.data;
}
