import apiClient from "./client";

export async function getApiKeys() {
  const { data } = await apiClient.get("/api-keys");
  return data;
}

export async function createApiKey(payload) {
  const { data } = await apiClient.post("/api-keys", payload);
  return data;
}

export async function revokeApiKey(id) {
  const { data } = await apiClient.post(`/api-keys/${id}/revoke`);
  return data;
}

export async function deleteApiKey(id) {
  const { data } = await apiClient.delete(`/api-keys/${id}`);
  return data;
}
