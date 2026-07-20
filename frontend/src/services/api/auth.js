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
 * Ends the current device's session only.
 */
export async function logout() {
  const { data } = await apiClient.post("/auth/logout");
  return data;
}

/**
 * POST /api/auth/logout-all
 * Ends every session for this user, including the current device.
 */
export async function logoutAll() {
  const { data } = await apiClient.post("/auth/logout-all");
  return data;
}

/**
 * POST /api/auth/logout-others
 * Ends every session for this user except the current device.
 */
export async function logoutOthers() {
  const { data } = await apiClient.post("/auth/logout-others");
  return data;
}

/**
 * GET /api/auth/sessions
 */
export async function getSessions() {
  const { data } = await apiClient.get("/auth/sessions");
  return data;
}

/**
 * DELETE /api/auth/sessions/:sessionId
 */
export async function revokeSession(sessionId) {
  const { data } = await apiClient.delete(`/auth/sessions/${sessionId}`);
  return data;
}

/**
 * GET /api/auth/me
 */
export async function getMe() {
  const { data } = await apiClient.get("/auth/me");
  return data;
}

/**
 * POST /api/auth/verify-email
 */
export async function verifyEmail(token) {
  const { data } = await apiClient.post("/auth/verify-email", { token });
  return data;
}

/**
 * POST /api/auth/resend-verification
 */
export async function resendVerification(email) {
  const { data } = await apiClient.post("/auth/resend-verification", {
    email,
  });
  return data;
}

/**
 * POST /api/auth/forgot-password
 */
export async function forgotPassword(email) {
  const { data } = await apiClient.post("/auth/forgot-password", { email });
  return data;
}

/**
 * POST /api/auth/reset-password
 */
export async function resetPassword({ token, password, confirmPassword }) {
  const { data } = await apiClient.post("/auth/reset-password", {
    token,
    password,
    confirmPassword,
  });
  return data;
}
