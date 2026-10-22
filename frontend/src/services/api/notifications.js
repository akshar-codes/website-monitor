import apiClient from "./client";
export async function getNotifications(params) {
  const { data } = await apiClient.get("/notifications", { params });
  return data;
}
export async function getUnreadSummary() {
  const { data } = await apiClient.get("/notifications/unread-count");
  return data;
}
export async function markAsRead(id) {
  const { data } = await apiClient.patch("/notifications/" + id + "/read");
  return data;
}
export async function markAllAsRead(category) {
  const { data } = await apiClient.post("/notifications/mark-all-read", {
    category,
  });
  return data;
}
export async function deleteNotification(id) {
  const { data } = await apiClient.delete("/notifications/" + id);
  return data;
}
export async function clearReadNotifications() {
  const { data } = await apiClient.delete("/notifications/read");
  return data;
}
