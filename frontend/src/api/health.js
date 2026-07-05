import httpClient from "./httpClient";

export const fetchServerHealth = () =>
  httpClient.get("/api/health").then((res) => res);
