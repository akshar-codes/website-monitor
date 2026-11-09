import asyncHandler from "../utils/asyncHandler.js";
import * as sloService from "../services/slo.service.js";
import { sendSuccess, sendPaginated } from "../utils/apiResponse.js";

/**
 * POST /api/slos
 * Create a new Service Level Objective.
 */
export const createSlo = asyncHandler(async (req, res) => {
  const slo = await sloService.createSlo(req.body, req.user);

  sendSuccess(res, {
    statusCode: 201,
    message: "SLO created successfully",
    data: slo,
  });
});

/**
 * GET /api/slos
 * List SLOs (paginated, scoped to current user).
 */
export const getSlos = asyncHandler(async (req, res) => {
  const query = req.validatedQuery;
  const result = await sloService.getSlos(query, req.user);

  sendPaginated(res, {
    data: result.slos,
    page: result.page,
    limit: query.limit,
    total: result.total,
  });
});

/**
 * GET /api/slos/:id
 * Retrieve single SLO by ID.
 */
export const getSloById = asyncHandler(async (req, res) => {
  const slo = await sloService.getSloById(req.params.id, req.user);

  sendSuccess(res, { data: slo });
});

/**
 * PUT /api/slos/:id
 * Update an existing SLO.
 */
export const updateSlo = asyncHandler(async (req, res) => {
  const slo = await sloService.updateSlo(req.params.id, req.body, req.user);

  sendSuccess(res, {
    message: "SLO updated successfully",
    data: slo,
  });
});

/**
 * DELETE /api/slos/:id
 * Delete an existing SLO.
 */
export const deleteSlo = asyncHandler(async (req, res) => {
  await sloService.deleteSlo(req.params.id, req.user);

  sendSuccess(res, {
    message: "SLO deleted successfully",
  });
});
