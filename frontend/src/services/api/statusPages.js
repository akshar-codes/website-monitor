import apiClient from "./client";
import { getUsage } from "./usage";

export async function listStatusPages() {
  return (await apiClient.get("/status-pages")).data;
}
export async function getStatusPage(id) {
  return (await apiClient.get(`/status-pages/${id}`)).data;
}
export async function getStatusPreview(id, window = "90d") {
  return (
    await apiClient.get(`/status-pages/${id}/preview`, { params: { window } })
  ).data;
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
export async function updateStatusService(id, serviceId, payload) {
  return (
    await apiClient.patch(`/status-pages/${id}/services/${serviceId}`, payload)
  ).data;
}
export async function removeStatusService(id, serviceId) {
  return (await apiClient.delete(`/status-pages/${id}/services/${serviceId}`))
    .data;
}
export async function reorderStatusServices(id, serviceIds) {
  return (
    await apiClient.patch(`/status-pages/${id}/services/reorder`, {
      serviceIds,
    })
  ).data;
}
export async function getStatusIncidents(id) {
  return (await apiClient.get(`/status-pages/${id}/incidents`)).data;
}
export async function createStatusIncident(id, payload) {
  return (await apiClient.post(`/status-pages/${id}/incidents`, payload)).data;
}
export async function updateStatusIncident(id, incidentId, payload) {
  return (
    await apiClient.patch(
      `/status-pages/${id}/incidents/${incidentId}`,
      payload,
    )
  ).data;
}
export async function addStatusIncidentUpdate(id, incidentId, payload) {
  return (
    await apiClient.post(
      `/status-pages/${id}/incidents/${incidentId}/updates`,
      payload,
    )
  ).data;
}
export async function publishStatusIncident(id, incidentId) {
  return (
    await apiClient.post(`/status-pages/${id}/incidents/${incidentId}/publish`)
  ).data;
}
export async function resolveStatusIncident(id, incidentId, payload = {}) {
  return (
    await apiClient.post(
      `/status-pages/${id}/incidents/${incidentId}/resolve`,
      payload,
    )
  ).data;
}
export async function getStatusMaintenance(id) {
  return (await apiClient.get(`/status-pages/${id}/maintenance`)).data;
}
export async function createStatusMaintenance(id, payload) {
  return (await apiClient.post(`/status-pages/${id}/maintenance`, payload))
    .data;
}
export async function updateStatusMaintenance(id, itemId, payload) {
  return (
    await apiClient.patch(`/status-pages/${id}/maintenance/${itemId}`, payload)
  ).data;
}
export async function deleteStatusMaintenance(id, itemId) {
  return (await apiClient.delete(`/status-pages/${id}/maintenance/${itemId}`))
    .data;
}
export async function getStatusSubscriberStats(id) {
  return (await apiClient.get(`/status-pages/${id}/subscriber-stats`)).data;
}
export { getUsage };
export async function subscribeToStatus(slug, payload) {
  return (await apiClient.post(`/public/status/${slug}/subscribe`, payload))
    .data;
}
export async function verifyStatusSubscription(token) {
  return (await apiClient.post("/public/status/verify-subscription", { token }))
    .data;
}
export async function unsubscribeFromStatus(token) {
  return (await apiClient.post("/public/status/unsubscribe", { token })).data;
}
export async function getSubscriberPreferences(token) {
  return (
    await apiClient.post("/public/status/subscription-preferences/read", {
      token,
    })
  ).data;
}
export async function updateSubscriberPreferences(token, preferences) {
  return (
    await apiClient.post("/public/status/subscription-preferences", {
      token,
      preferences,
    })
  ).data;
}
export async function getPublicStatus(slug, window = "90d") {
  return (await apiClient.get(`/public/status/${slug}`, { params: { window } }))
    .data;
}
