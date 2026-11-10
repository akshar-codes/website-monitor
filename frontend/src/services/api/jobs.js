import apiClient from "./client.js";

/**
 * GET /api/job-monitors
 * List job monitors with filtering and pagination.
 */
export async function getJobMonitors(params = {}) {
  const { data } = await apiClient.get("/job-monitors", { params });
  return data;
}

/**
 * GET /api/job-monitors/:id
 * Retrieve a single job monitor by ID.
 */
export async function getJobMonitorById(id) {
  const { data } = await apiClient.get(`/job-monitors/${id}`);
  return data?.data || data;
}

/**
 * POST /api/job-monitors
 * Create a new job monitor. Returns plaintext token in response data.
 */
export async function createJobMonitor(payload) {
  const { data } = await apiClient.post("/job-monitors", payload);
  return data?.data || data;
}

/**
 * PATCH /api/job-monitors/:id
 * Update an existing job monitor configuration.
 */
export async function updateJobMonitor(id, payload) {
  const { data } = await apiClient.patch(`/job-monitors/${id}`, payload);
  return data?.data || data;
}

/**
 * DELETE /api/job-monitors/:id
 * Delete a job monitor and its execution history.
 */
export async function deleteJobMonitor(id) {
  const { data } = await apiClient.delete(`/job-monitors/${id}`);
  return data;
}

/**
 * POST /api/job-monitors/:id/rotate-token
 * Rotates the heartbeat reporting token with a 24h grace period for previous token.
 */
export async function rotateJobMonitorToken(id) {
  const { data } = await apiClient.post(`/job-monitors/${id}/rotate-token`);
  return data?.data || data;
}

/**
 * PATCH /api/job-monitors/:id/pause
 * Toggles active/paused status of a job monitor.
 */
export async function toggleJobMonitorPause(id) {
  const { data } = await apiClient.patch(`/job-monitors/${id}/pause`);
  return data?.data || data;
}

/**
 * GET /api/job-monitors/:id/runs
 * Retrieve execution runs history for a job monitor.
 */
export async function getJobRuns(id, params = {}) {
  const { data } = await apiClient.get(`/job-monitors/${id}/runs`, { params });
  return data;
}
