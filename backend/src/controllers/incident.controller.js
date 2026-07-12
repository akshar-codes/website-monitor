import asyncHandler from "../utils/asyncHandler.js";
import * as incidentService from "../services/incident.service.js";
import { assertObjectId, validate } from "../utils/controllerHelpers.js";
import {
  listIncidentsSchema,
  updateStatusSchema,
  downtimeStatsSchema,
} from "../validators/incident.validator.js";

// ── Controllers ──────────────────────────────────────────────────────────────

/**
 * GET /api/incidents
 * List incidents with filtering and pagination.
 */
export const getIncidents = asyncHandler(async (req, res) => {
  const query = validate(listIncidentsSchema, req.query);

  if (query.monitorId) {
    assertObjectId(query.monitorId);
  }

  const result = await incidentService.getIncidents(query);

  res.json({
    success: true,
    data: result.incidents,
    pagination: {
      total: result.total,
      page: result.page,
      totalPages: result.totalPages,
    },
  });
});

/**
 * GET /api/incidents/:id
 * Single incident with populated relations.
 */
export const getIncidentById = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id);
  const data = await incidentService.getIncidentById(req.params.id);

  res.json({
    success: true,
    data,
  });
});

/**
 * PATCH /api/incidents/:id/status
 * Update incident status with transition validation.
 */
export const updateIncidentStatus = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id);
  const body = validate(updateStatusSchema, req.body);
  const data = await incidentService.updateIncidentStatus(req.params.id, body);

  res.json({
    success: true,
    data,
  });
});

/**
 * GET /api/incidents/downtime-stats
 * Aggregate downtime statistics.
 */
export const getDowntimeStats = asyncHandler(async (req, res) => {
  const query = validate(downtimeStatsSchema, req.query);

  if (query.monitorId) {
    assertObjectId(query.monitorId);
  }

  const data = await incidentService.getDowntimeStats(query);

  res.json({
    success: true,
    data,
  });
});
