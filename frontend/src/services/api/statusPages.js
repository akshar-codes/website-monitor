import apiClient from "./client";

export async function listStatusPages() {
  return (await apiClient.get("/status-pages")).data;
}
export async function createStatusPage(payload) {
  return (await apiClient.post("/status-pages", payload)).data;
}
export async function updateStatusPage(id, payload) {
  return (await apiClient.patch(`/status-pages/${id}`, payload)).data;
}
export async function deleteStatusPage(id) {
  return (await apiClient.delete(`/status-pages/${id}`)).data;
}
export async function publishStatusPage(id) {
  return (await apiClient.post(`/status-pages/${id}/publish`)).data;
}
export async function unpublishStatusPage(id) {
  return (await apiClient.post(`/status-pages/${id}/unpublish`)).data;
}
export async function addStatusService(id, payload) {
  return (await apiClient.post(`/status-pages/${id}/services`, payload)).data;
}
export async function removeStatusService(id, serviceId) {
  return (await apiClient.delete(`/status-pages/${id}/services/${serviceId}`))
    .data;
}
export async function getPublicStatus(slug) {
  return (await apiClient.get(`/public/status/${slug}`)).data;
}
