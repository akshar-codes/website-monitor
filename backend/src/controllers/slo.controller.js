import asyncHandler from "../utils/asyncHandler.js";
import * as sloService from "../services/slo.service.js";
import * as sloEvaluationService from "../services/sloEvaluation.service.js";
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

/**
 * POST /api/slos/:id/evaluate
 * Trigger evaluation and snapshot calculation on demand.
 */
export const triggerEvaluation = asyncHandler(async (req, res) => {
  await sloService.getSloById(req.params.id, req.user);

  const evaluation = await sloEvaluationService.evaluateSlo(req.params.id, {
    now: new Date(),
    persistSnapshot: true,
  });

  sendSuccess(res, {
    message: "SLO evaluated successfully",
    data: evaluation.snapshot || evaluation.result,
  });
});

/**
 * GET /api/slos/:id/snapshots
 * Get historical evaluation snapshots (paginated).
 */
export const getSnapshots = asyncHandler(async (req, res) => {
  const query = req.query || {};
  const result = await sloEvaluationService.getSloSnapshots(
    req.params.id,
    query,
    req.user,
  );

  sendPaginated(res, {
    data: result.snapshots,
    page: result.page,
    limit: query.limit || 20,
    total: result.total,
  });
});

/**
 * GET /api/slos/:id/latest
 * Get the latest evaluation snapshot.
 */
export const getLatestSnapshot = asyncHandler(async (req, res) => {
  const snapshot = await sloEvaluationService.getLatestSloSnapshot(
    req.params.id,
    req.user,
  );

  sendSuccess(res, { data: snapshot });
});

/**
 * GET /api/slos/:id/alert-state
 * Get current persistent alert state (active alerts, burn rates, forecast).
 */
export const getAlertState = asyncHandler(async (req, res) => {
  const alertState = await sloEvaluationService.getSloAlertState(
    req.params.id,
    req.user,
  );

  sendSuccess(res, { data: alertState });
});
