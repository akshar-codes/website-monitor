import mongoose from "mongoose";
import Incident from "../models/Incident.js";
import ApiError from "../utils/ApiError.js";
import {
  WINDOW_MS,
  INCIDENT_STATUS,
  INCIDENT_SEVERITY,
  MONITOR_POPULATE_FIELDS,
  TRIGGER_CHECK_POPULATE_FIELDS,
  TRIGGER_CHECK_DETAIL_POPULATE_FIELDS,
} from "../config/constants.js";
import { msBefore } from "../utils/dateUtils.js";

// ── State machine ─────────────────────────────────────────────────────────────

/** Valid forward-only status transitions. */
const ALLOWED_TRANSITIONS = {
  [INCIDENT_STATUS.ONGOING]: [
    INCIDENT_STATUS.INVESTIGATING,
    INCIDENT_STATUS.IDENTIFIED,
    INCIDENT_STATUS.RESOLVED,
  ],
  [INCIDENT_STATUS.INVESTIGATING]: [
    INCIDENT_STATUS.IDENTIFIED,
    INCIDENT_STATUS.RESOLVED,
  ],
  [INCIDENT_STATUS.IDENTIFIED]: [INCIDENT_STATUS.RESOLVED],
  [INCIDENT_STATUS.RESOLVED]: [], // terminal
};

// ── List incidents ────────────────────────────────────────────────────────────

export const getIncidents = async ({
  page,
  limit,
  severity,
  status,
  monitorId,
}) => {
  const filter = {};

  if (status === "active") {
    filter.status = { $ne: INCIDENT_STATUS.RESOLVED };
  } else if (status) {
    filter.status = status;
  }

  if (severity) {
    filter.severity = severity;
  }

  if (monitorId) {
    filter.monitor = new mongoose.Types.ObjectId(monitorId);
  }

  const skip = (page - 1) * limit;

  const [incidents, total] = await Promise.all([
    Incident.find(filter)
      .populate("monitor", MONITOR_POPULATE_FIELDS)
      .populate("triggerCheck", TRIGGER_CHECK_POPULATE_FIELDS)
      .sort({ startedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Incident.countDocuments(filter),
  ]);

  return {
    incidents,
    total,
    page,
    totalPages: Math.ceil(total / limit) || 1,
  };
};

// ── Single incident ───────────────────────────────────────────────────────────

export const getIncidentById = async (id) => {
  const incident = await Incident.findById(id)
    .populate("monitor", MONITOR_POPULATE_FIELDS)
    .populate("triggerCheck", TRIGGER_CHECK_DETAIL_POPULATE_FIELDS)
    .lean();

  if (!incident) {
    throw ApiError.notFound(`Incident not found with id: ${id}`);
  }

  return incident;
};

// ── Update status ─────────────────────────────────────────────────────────────

export const updateIncidentStatus = async (
  id,
  { status, rootCause, resolutionNotes },
) => {
  const incident = await Incident.findById(id);
  if (!incident) {
    throw ApiError.notFound(`Incident not found with id: ${id}`);
  }

  const allowed = ALLOWED_TRANSITIONS[incident.status] || [];
  if (!allowed.includes(status)) {
    throw ApiError.badRequest(
      `Invalid status transition from "${incident.status}" to "${status}"`,
    );
  }

  if (status === INCIDENT_STATUS.RESOLVED) {
    const resolved = await Incident.resolve(id, { rootCause, resolutionNotes });
    return Incident.findById(resolved._id)
      .populate("monitor", MONITOR_POPULATE_FIELDS)
      .populate("triggerCheck", TRIGGER_CHECK_POPULATE_FIELDS)
      .lean();
  }

  incident.status = status;
  if (rootCause != null) incident.rootCause = rootCause;
  await incident.save();

  return Incident.findById(incident._id)
    .populate("monitor", MONITOR_POPULATE_FIELDS)
    .populate("triggerCheck", TRIGGER_CHECK_POPULATE_FIELDS)
    .lean();
};

// ── Downtime statistics ───────────────────────────────────────────────────────

export const getDowntimeStats = async ({ monitorId, window }) => {
  const since = msBefore(WINDOW_MS[window]);

  const matchFilter = { startedAt: { $gte: since } };
  if (monitorId) {
    matchFilter.monitor = new mongoose.Types.ObjectId(monitorId);
  }

  const [aggResult] = await Incident.aggregate([
    { $match: matchFilter },
    {
      $group: {
        _id: null,
        totalIncidents: { $sum: 1 },
        resolvedCount: {
          $sum: {
            $cond: [{ $eq: ["$status", INCIDENT_STATUS.RESOLVED] }, 1, 0],
          },
        },
        ongoingCount: {
          $sum: {
            $cond: [{ $ne: ["$status", INCIDENT_STATUS.RESOLVED] }, 1, 0],
          },
        },
        resolvedDowntime: {
          $sum: { $ifNull: ["$duration", 0] },
        },
        avgDuration: {
          $avg: {
            $cond: [{ $ne: ["$duration", null] }, "$duration", null],
          },
        },
        maxDuration: { $max: "$duration" },
        criticalCount: {
          $sum: {
            $cond: [{ $eq: ["$severity", INCIDENT_SEVERITY.CRITICAL] }, 1, 0],
          },
        },
        majorCount: {
          $sum: {
            $cond: [{ $eq: ["$severity", INCIDENT_SEVERITY.MAJOR] }, 1, 0],
          },
        },
        minorCount: {
          $sum: {
            $cond: [{ $eq: ["$severity", INCIDENT_SEVERITY.MINOR] }, 1, 0],
          },
        },
      },
    },
  ]);

  const stats = aggResult || {
    totalIncidents: 0,
    resolvedCount: 0,
    ongoingCount: 0,
    resolvedDowntime: 0,
    avgDuration: null,
    maxDuration: null,
    criticalCount: 0,
    majorCount: 0,
    minorCount: 0,
  };

  // Add live downtime for ongoing incidents
  let liveDowntime = 0;
  if (stats.ongoingCount > 0) {
    const activeIncidents = await Incident.find({
      ...matchFilter,
      status: { $ne: INCIDENT_STATUS.RESOLVED },
    })
      .select("startedAt")
      .lean();

    const now = Date.now();
    liveDowntime = activeIncidents.reduce(
      (sum, inc) => sum + (now - new Date(inc.startedAt).getTime()) / 1000,
      0,
    );
  }

  return {
    totalIncidents: stats.totalIncidents,
    resolvedCount: stats.resolvedCount,
    ongoingCount: stats.ongoingCount,
    totalDowntimeSeconds: Math.round(stats.resolvedDowntime + liveDowntime),
    mttr: stats.avgDuration ? Math.round(stats.avgDuration) : null,
    longestIncident: stats.maxDuration || null,
    bySeverity: {
      critical: stats.criticalCount,
      major: stats.majorCount,
      minor: stats.minorCount,
    },
    window,
  };
};
