import asyncHandler from "../utils/asyncHandler.js";
import * as incidentService from "../services/incident.service.js";
import { sendSuccess, sendPaginated } from "../utils/apiResponse.js";

// ── Controllers ──────────────────────────────────────────────────────────────

/**
 * GET /api/incidents
 * List incidents with filtering and pagination, scoped to the caller's
 * own monitors.
 */
export const getIncidents = asyncHandler(async (req, res) => {
  const query = req.validatedQuery;
  const result = await incidentService.getIncidents(query, req.user);

  sendPaginated(res, {
    data: result.incidents,
    page: result.page,
    limit: query.limit,
    total: result.total,
  });
});

/**
 * GET /api/incidents/:id
 * Single incident with populated relations. 404s if the incident's
 * monitor isn't owned by the caller.
 */
export const getIncidentById = asyncHandler(async (req, res) => {
  const data = await incidentService.getIncidentById(req.params.id, req.user);

  sendSuccess(res, { data });
});

/**
 * PATCH /api/incidents/:id/status
 * Update incident status with transition validation.
 */
export const updateIncidentStatus = asyncHandler(async (req, res) => {
  const data = await incidentService.updateIncidentStatus(
    req.params.id,
    req.body,
    req.user,
  );

  sendSuccess(res, { data });
});

/**
 * GET /api/incidents/downtime-stats
 * Aggregate downtime statistics, scoped to the caller.
 */
export const getDowntimeStats = asyncHandler(async (req, res) => {
  const data = await incidentService.getDowntimeStats(
    req.validatedQuery,
    req.user,
  );

  sendSuccess(res, { data });
});
