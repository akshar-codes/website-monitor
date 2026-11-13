import asyncHandler from "../utils/asyncHandler.js";
import { sendSuccess, sendPaginated } from "../utils/apiResponse.js";
import * as dependencyService from "../services/dependency.service.js";

/**
 * GET /api/dependencies/graph
 * Retrieve the complete dependency graph with node metadata and health status.
 */
export const getDependencyGraph = asyncHandler(async (req, res) => {
  const options = req.validatedQuery || req.query;
  const data = await dependencyService.getDependencyGraph(req.user, options);
  sendSuccess(res, { data });
});

/**
 * GET /api/dependencies
 * Retrieve list of dependencies with filtering and pagination.
 */
export const getDependencies = asyncHandler(async (req, res) => {
  const query = req.validatedQuery || req.query;
  const result = await dependencyService.getDependencies(query, req.user);
  sendPaginated(res, {
    data: result.dependencies,
    page: result.page,
    limit: query.limit || 50,
    total: result.total,
  });
});

/**
 * GET /api/dependencies/monitor/:id
 * Retrieve direct dependencies and dependents for a specific monitor.
 */
export const getMonitorDependencies = asyncHandler(async (req, res) => {
  const data = await dependencyService.getMonitorDependencies(
    req.params.id,
    req.user,
  );
  sendSuccess(res, { data });
});

/**
 * POST /api/dependencies
 * Create a new directed dependency relationship.
 */
export const createDependency = asyncHandler(async (req, res) => {
  const data = await dependencyService.createDependency(req.body, req.user);
  sendSuccess(res, {
    statusCode: 201,
    message: "Service dependency created successfully",
    data,
  });
});

/**
 * POST /api/dependencies/validate
 * Pre-flight validation of a proposed dependency without committing.
 */
export const validateProposedDependency = asyncHandler(async (req, res) => {
  const data = await dependencyService.validateProposedDependency(
    req.body,
    req.user,
  );
  sendSuccess(res, { data });
});

/**
 * PUT /api/dependencies/:id
 * Update relationship metadata or active status.
 */
export const updateDependency = asyncHandler(async (req, res) => {
  const data = await dependencyService.updateDependency(
    req.params.id,
    req.body,
    req.user,
  );
  sendSuccess(res, {
    message: "Service dependency updated successfully",
    data,
  });
});

/**
 * DELETE /api/dependencies/:id
 * Remove a dependency relationship.
 */
export const deleteDependency = asyncHandler(async (req, res) => {
  const data = await dependencyService.deleteDependency(
    req.params.id,
    req.user,
  );
  sendSuccess(res, {
    message: "Service dependency removed successfully",
    data,
  });
});
