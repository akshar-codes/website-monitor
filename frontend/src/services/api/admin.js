import apiClient from "./client";

export async function getAdminDashboard(params = {}) {
  const { data } = await apiClient.get("/admin/dashboard", { params });
  return data?.data;
}

/**
 * GET /api/admin/users
 * Supports pagination plus optional { search, role, plan, status } filters.
 */
export async function getUsers(params = {}) {
  const { data } = await apiClient.get("/admin/users", { params });
  return data;
}

export async function getAdminUser(userId) {
  const { data } = await apiClient.get(`/admin/users/${userId}`);
  return data?.data;
}

/**
 * PATCH /api/admin/users/:id/role
 */
export async function updateUserRole(userId, role, reason) {
  const { data } = await apiClient.patch(`/admin/users/${userId}/role`, {
    role,
    reason,
  });
  return data;
}

/**
 * PATCH /api/admin/users/:id/plan
 */
export async function updateUserPlan(userId, plan) {
  const { data } = await apiClient.patch(`/admin/users/${userId}/plan`, {
    plan,
  });
  return data;
}

/**
 * POST /api/admin/users/:id/suspend
 */
export async function suspendUser(userId, reason) {
  const { data } = await apiClient.post(`/admin/users/${userId}/suspend`, {
    reason,
  });
  return data;
}

/**
 * POST /api/admin/users/:id/reactivate
 */
export async function reactivateUser(userId, reason) {
  const { data } = await apiClient.post(`/admin/users/${userId}/reactivate`, {
    reason,
  });
  return data;
}

/**
 * DELETE /api/admin/users/:id
 */
export async function deleteUser(userId) {
  const { data } = await apiClient.delete(`/admin/users/${userId}`);
  return data;
}

/**
 * GET /api/admin/plan-upgrade-requests
 * Supports pagination plus an optional { status } filter
 * ("pending" | "approved" | "rejected").
 */
export async function getPlanUpgradeRequests(params = {}) {
  const { data } = await apiClient.get("/admin/plan-upgrade-requests", {
    params,
  });
  return data;
}

/**
 * PATCH /api/admin/plan-upgrade-requests/:id/approve
 */
export async function approvePlanUpgradeRequest(requestId, grantedPlan) {
  const { data } = await apiClient.patch(
    `/admin/plan-upgrade-requests/${requestId}/approve`,
    grantedPlan ? { grantedPlan } : {},
  );
  return data;
}

/**
 * PATCH /api/admin/plan-upgrade-requests/:id/reject
 */
export async function rejectPlanUpgradeRequest(requestId, reason) {
  const { data } = await apiClient.patch(
    `/admin/plan-upgrade-requests/${requestId}/reject`,
    reason ? { reason } : {},
  );
  return data;
}
