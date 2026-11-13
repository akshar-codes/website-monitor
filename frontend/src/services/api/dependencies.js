import apiClient from "./client.js";

/**
 * GET /api/dependencies/graph
 * Retrieve the complete dependency graph with node metadata and health status.
 */
export async function getDependencyGraph(params = {}) {
  const { data } = await apiClient.get("/dependencies/graph", { params });
  return data;
}

/**
 * GET /api/dependencies
 * Retrieve list of dependencies with filtering and pagination.
 */
export async function getDependencies(params = {}) {
  const { data } = await apiClient.get("/dependencies", { params });
  return data;
}

/**
 * GET /api/dependencies/monitor/:id
 * Retrieve direct dependencies and dependents for a specific monitor.
 */
export async function getMonitorDependencies(monitorId) {
  const { data } = await apiClient.get(`/dependencies/monitor/${monitorId}`);
  return data;
}

/**
 * POST /api/dependencies
 * Create a new service dependency relationship.
 */
export async function createDependency(payload) {
  const { data } = await apiClient.post("/dependencies", payload);
  return data;
}

/**
 * POST /api/dependencies/validate
 * Pre-flight validation of a proposed dependency without committing.
 */
export async function validateProposedDependency(payload) {
  const { data } = await apiClient.post("/dependencies/validate", payload);
  return data;
}

/**
 * PUT /api/dependencies/:id
 * Update relationship metadata or enabled status.
 */
export async function updateDependency(id, payload) {
  const { data } = await apiClient.put(`/dependencies/${id}`, payload);
  return data;
}

/**
 * DELETE /api/dependencies/:id
 * Remove a dependency relationship.
 */
export async function deleteDependency(id) {
  const { data } = await apiClient.delete(`/dependencies/${id}`);
  return data;
}

/**
 * GET /api/external-services
 * List unmonitored external services (databases, third-party APIs, etc.).
 */
export async function getExternalServices(params = {}) {
  const { data } = await apiClient.get("/external-services", { params });
  return data;
}

/**
 * POST /api/external-services
 * Create an external service.
 */
export async function createExternalService(payload) {
  const { data } = await apiClient.post("/external-services", payload);
  return data;
}

/**
 * PUT /api/external-services/:id
 * Update external service metadata.
 */
export async function updateExternalService(id, payload) {
  const { data } = await apiClient.put(`/external-services/${id}`, payload);
  return data;
}

/**
 * DELETE /api/external-services/:id
 * Remove an external service and cascading dependencies.
 */
export async function deleteExternalService(id) {
  const { data } = await apiClient.delete(`/external-services/${id}`);
  return data;
}
