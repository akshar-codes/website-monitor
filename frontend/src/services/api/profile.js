import apiClient from "./client";

/**
 * GET /api/profile
 */
export async function getProfile() {
  const { data } = await apiClient.get("/profile");
  return data;
}

/**
 * PUT /api/profile
 */
export async function updateProfile(payload) {
  const { data } = await apiClient.put("/profile", payload);
  return data;
}

/**
 * POST /api/profile/avatar
 */
export async function uploadAvatar(file) {
  const formData = new FormData();
  formData.append("avatar", file);

  const { data } = await apiClient.post("/profile/avatar", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

/**
 * DELETE /api/profile/avatar
 */
export async function deleteAvatar() {
  const { data } = await apiClient.delete("/profile/avatar");
  return data;
}

/**
 * GET /api/profile/public/:id
 */
export async function getPublicProfile(userId) {
  const { data } = await apiClient.get(`/profile/public/${userId}`);
  return data;
}
