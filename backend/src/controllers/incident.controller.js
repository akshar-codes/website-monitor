const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const incidentService = require("../services/incident.service");
const {
  listIncidentsSchema,
  updateStatusSchema,
  downtimeStatsSchema,
} = require("../validators/incident.validator");
const mongoose = require("mongoose");

// ── Helpers ──

const assertObjectId = (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw ApiError.badRequest(`Invalid ID format: ${id}`);
  }
};

const validate = (schema, data) => {
  const result = schema.safeParse(data);
  if (!result.success) {
    const messages = result.error.errors.map((e) => e.message).join("; ");
    throw ApiError.badRequest(messages);
  }
  return result.data;
};

// ── Controllers ──

/**
 * GET /api/incidents
 * List incidents with filtering and pagination.
 */
const getIncidents = asyncHandler(async (req, res) => {
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
const getIncidentById = asyncHandler(async (req, res) => {
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
const updateIncidentStatus = asyncHandler(async (req, res) => {
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
const getDowntimeStats = asyncHandler(async (req, res) => {
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

module.exports = {
  getIncidents,
  getIncidentById,
  updateIncidentStatus,
  getDowntimeStats,
};
