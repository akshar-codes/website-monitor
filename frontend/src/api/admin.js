import apiClient from "./client";

/**
 * GET /api/admin/users
 */
export async function getUsers(params = {}) {
  const { data } = await apiClient.get("/admin/users", { params });
  return data;
}

/**
 * PATCH /api/admin/users/:id/role
 */
export async function updateUserRole(userId, role) {
  const { data } = await apiClient.patch(`/admin/users/${userId}/role`, {
    role,
  });
  return data;
}
