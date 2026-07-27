import apiClient from "./client";

/**
 * GET /api/usage
 * Fetches the current user's usage stats and plan limits.
 */
export async function getUsage() {
  const { data } = await apiClient.get("/usage");
  return data;
}
