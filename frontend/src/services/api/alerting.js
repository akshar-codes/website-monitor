import apiClient from "./client";

const data = (response) => response.data?.data;

export const getIntegrations = async () =>
  data(await apiClient.get("/integrations"));
export const createIntegration = async (input) =>
  data(await apiClient.post("/integrations", input));
export const getIntegration = async (id) =>
  data(await apiClient.get(`/integrations/${id}`));
export const updateIntegration = async (id, input) =>
  data(await apiClient.patch(`/integrations/${id}`, input));
export const testIntegration = async (id) =>
  data(await apiClient.post(`/integrations/${id}/test`, {}));
export const setIntegrationActive = async (id, active) =>
  data(
    await apiClient.post(
      `/integrations/${id}/${active ? "enable" : "disable"}`,
      {},
    ),
  );
export const deleteIntegration = async (id) =>
  data(await apiClient.delete(`/integrations/${id}`));
export const getNotificationRules = async () =>
  data(await apiClient.get("/notification-rules"));
export const createNotificationRule = async (input) =>
  data(await apiClient.post("/notification-rules", input));
export const updateNotificationRule = async (id, input) =>
  data(await apiClient.patch(`/notification-rules/${id}`, input));
export const deleteNotificationRule = async (id) =>
  data(await apiClient.delete(`/notification-rules/${id}`));
export const getAlertPolicies = async () =>
  data(await apiClient.get("/alert-policies"));
export const createAlertPolicy = async (input) =>
  data(await apiClient.post("/alert-policies", input));
export const updateAlertPolicy = async (id, input) =>
  data(await apiClient.patch(`/alert-policies/${id}`, input));
export const deleteAlertPolicy = async (id) =>
  data(await apiClient.delete(`/alert-policies/${id}`));
export const getNotificationDeliveries = async (query = {}) => {
  const response = await apiClient.get("/integrations/deliveries", {
    params: query,
  });
  return response.data;
};
export const retryNotificationDelivery = async (id) =>
  data(await apiClient.post(`/integrations/deliveries/${id}/retry`, {}));
export const getIncidentEscalations = async (id) =>
  data(await apiClient.get(`/incidents/${id}/escalations`));
export const acknowledgeIncident = async (id) =>
  data(await apiClient.post(`/incidents/${id}/acknowledge`, {}));
export const removeIncidentAcknowledgement = async (id) =>
  data(await apiClient.delete(`/incidents/${id}/acknowledge`));
