import apiClient from "./client";

/**
 * GET /api/monitors
 */
export async function getMonitors(params = {}) {
  const { data } = await apiClient.get("/monitors", { params });
  return data;
}

/**
 * GET /api/monitors/:id
 */
export async function getMonitorById(id) {
  const { data } = await apiClient.get(`/monitors/${id}`);
  return data;
}

/**
 * POST /api/monitors
 */
export async function createMonitor(payload) {
  const { data } = await apiClient.post("/monitors", payload);
  return data;
}

/**
 * PUT /api/monitors/:id
 */
export async function updateMonitor(id, payload) {
  const { data } = await apiClient.put(`/monitors/${id}`, payload);
  return data;
}

/**
 * DELETE /api/monitors/:id
 */
export async function deleteMonitor(id) {
  const { data } = await apiClient.delete(`/monitors/${id}`);
  return data;
}
