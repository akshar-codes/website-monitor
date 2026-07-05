import httpClient from "./httpClient";

export const fetchIncidents = (params = {}) =>
  httpClient.get("/api/incidents", { params }).then((res) => res);

export const fetchIncident = (id) =>
  httpClient.get(`/api/incidents/${id}`).then((res) => res);

export const updateIncidentStatus = (id, data) =>
  httpClient.patch(`/api/incidents/${id}/status`, data).then((res) => res);

export const fetchDowntimeStats = (params = {}) =>
  httpClient
    .get("/api/incidents/downtime-stats", { params })
    .then((res) => res);
