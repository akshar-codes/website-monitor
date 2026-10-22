import apiClient from "./client";

/**
 * GET /api/preferences
 */
export async function getPreferences() {
  const { data } = await apiClient.get("/preferences");
  return data;
}

/**
 * PUT /api/preferences
 */
export async function updatePreferences(payload) {
  const { data } = await apiClient.put("/preferences", payload);
  return data;
}

/**
 * PATCH /api/preferences/dashboard
 */
export async function updateDashboardPreferences(payload) {
  const { data } = await apiClient.patch("/preferences/dashboard", payload);
  return data;
}

export async function updateNotificationPreferences(payload) {
  const { data } = await apiClient.patch("/preferences/notifications", payload);
  return data;
}

/**
 * POST /api/preferences/reset
 */
export async function resetPreferences() {
  const { data } = await apiClient.post("/preferences/reset");
  return data;
}
