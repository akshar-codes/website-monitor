import apiClient from "./client";

export async function submitSuggestion(payload) {
  const { data } = await apiClient.post("/suggestions", payload);
  return data;
}

export async function getMySuggestions() {
  const { data } = await apiClient.get("/suggestions");
  return data;
}

export async function getAdminSuggestions() {
  const { data } = await apiClient.get("/admin/suggestions");
  return data;
}

export async function markSuggestionReviewed(id) {
  const { data } = await apiClient.patch(`/admin/suggestions/${id}/review`);
  return data;
}

export async function replyToSuggestion(id, reply) {
  const { data } = await apiClient.post(`/admin/suggestions/${id}/reply`, {
    reply,
  });
  return data;
}
