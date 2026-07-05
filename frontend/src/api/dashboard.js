import httpClient from "./httpClient";

export const fetchDashboard = () =>
  httpClient.get("/api/dashboard/overview").then((res) => res);

export const fetchActiveIncidents = (params = {}) =>
  httpClient.get("/api/dashboard/incidents", { params }).then((res) => res);

export const fetchRecentHealthChecks = (params = {}) =>
  httpClient.get("/api/dashboard/health-checks", { params }).then((res) => res);

export const fetchMonitorStats = (id, params = {}) =>
  httpClient
    .get(`/api/dashboard/monitors/${id}/stats`, { params })
    .then((res) => res);

export const fetchMonitorChartData = (id, params = {}) =>
  httpClient
    .get(`/api/dashboard/monitors/${id}/chart-data`, { params })
    .then((res) => res);
