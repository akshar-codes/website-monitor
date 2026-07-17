import apiClient from "./client";

/**
 * POST /api/auth/register
 */
export async function register(payload) {
  const { data } = await apiClient.post("/auth/register", payload);
  return data;
}

/**
 * POST /api/auth/login
 */
export async function login(payload) {
  const { data } = await apiClient.post("/auth/login", payload);
  return data;
}

/**
 * POST /api/auth/logout
 */
export async function logout() {
  const { data } = await apiClient.post("/auth/logout");
  return data;
}

/**
 * GET /api/auth/me
 */
export async function getMe() {
  const { data } = await apiClient.get("/auth/me");
  return data;
}
