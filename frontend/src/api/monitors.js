import httpClient from "./httpClient";

export const fetchMonitors = (params = {}) =>
  httpClient.get("/api/monitors", { params }).then((res) => res);

export const fetchMonitor = (id) =>
  httpClient.get(`/api/monitors/${id}`).then((res) => res);

export const createMonitor = (data) =>
  httpClient.post("/api/monitors", data).then((res) => res);

export const updateMonitor = (id, data) =>
  httpClient.put(`/api/monitors/${id}`, data).then((res) => res);

export const deleteMonitor = (id) =>
  httpClient.delete(`/api/monitors/${id}`).then((res) => res);
