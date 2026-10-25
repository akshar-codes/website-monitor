import apiClient from "./client";

export async function getAdminDashboard(params = {}) {
  const { data } = await apiClient.get("/admin/dashboard", { params });
  return data?.data;
}

export async function getAdminMonitors(params = {}) {
  const { data } = await apiClient.get("/admin/monitors", { params });
  return data;
}
export async function getAdminMonitor(id, params = {}) {
  const { data } = await apiClient.get(`/admin/monitors/${id}`, { params });
  return data?.data;
}
export async function checkAdminMonitor(id) {
  const { data } = await apiClient.post(`/admin/monitors/${id}/check`);
  return data?.data;
}
export async function getAdminIncidents(params = {}) {
  const { data } = await apiClient.get("/admin/incidents", { params });
  return data;
}
export async function getAdminIncident(id) {
  const { data } = await apiClient.get(`/admin/incidents/${id}`);
  return data?.data;
}
export async function resolveAdminIncident(id, payload) {
  const { data } = await apiClient.post(
    `/admin/incidents/${id}/resolve`,
    payload,
  );
  return data?.data;
}

export async function getAdminAuditEvents(params = {}) {
  const { data } = await apiClient.get("/admin/audit-logs", { params });
  return data;
}
export async function getAdminAuditEvent(id) {
  const { data } = await apiClient.get(`/admin/audit-logs/${id}`);
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

export async function getAdminUserPlan(userId) {
  const { data } = await apiClient.get(`/admin/users/${userId}/plan`);
  return data?.data;
}

export async function getAdminPlanOverview() {
  const { data } = await apiClient.get("/admin/plans/overview");
  return data?.data || [];
}

export async function getAdminPlanHistory() {
  const { data } = await apiClient.get("/admin/plans/history");
  return data?.data || [];
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
export async function updateUserPlan(userId, plan, { reason, expiresAt } = {}) {
  const { data } = await apiClient.patch(`/admin/users/${userId}/plan`, {
    plan,
    reason,
    ...(expiresAt ? { expiresAt } : {}),
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
export async function approvePlanUpgradeRequest(
  requestId,
  { grantedPlan, reason, expiresAt } = {},
) {
  const { data } = await apiClient.patch(
    `/admin/plan-upgrade-requests/${requestId}/approve`,
    {
      ...(grantedPlan ? { grantedPlan } : {}),
      reason,
      ...(expiresAt ? { expiresAt } : {}),
    },
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
