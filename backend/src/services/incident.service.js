import mongoose from "mongoose";
import Incident from "../models/Incident.js";
import Monitor from "../models/Monitor.js";
import ApiError from "../utils/ApiError.js";
import {
  WINDOW_MS,
  INCIDENT_STATUS,
  INCIDENT_STATUS_FILTER_ACTIVE,
  INCIDENT_STATUS_FILTER_ALL,
  INCIDENT_SEVERITY,
  MONITOR_POPULATE_FIELDS,
  TRIGGER_CHECK_POPULATE_FIELDS,
  TRIGGER_CHECK_DETAIL_POPULATE_FIELDS,
} from "../config/constants.js";
import { msBefore } from "../utils/dateUtils.js";
import { escapeRegExp } from "../utils/regex.js";
import { getOwnedMonitorIds } from "./monitor.service.js";
import { logActivity } from "../utils/activityLogger.js";
import {
  ACTIVITY_CATEGORIES,
  ACTIVITY_ACTIONS,
} from "../config/activityConstants.js";
import { syncIncidentById } from "./statusIncidentSync.service.js";
import { createNotification } from "./notification.service.js";

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

const resolveMonitorFilter = (ownedIds, monitorId) => {
  if (!monitorId) return { $in: ownedIds };
  const requested = new mongoose.Types.ObjectId(monitorId);
  return ownedIds.some((id) => id.equals(requested)) ? requested : { $in: [] };
};

const restoreCheckSnapshots = (incident) => ({
  ...incident,
  triggerCheck: incident.triggerCheck || incident.triggerCheckSnapshot || null,
  recoveryCheck:
    incident.recoveryCheck || incident.recoveryCheckSnapshot || null,
});

// ── List incidents ────────────────────────────────────────────────────────────

export const getIncidents = async (
  {
    page,
    limit,
    severity,
    status,
    monitorId,
    search,
    window,
    startDate,
    endDate,
    order,
  },
  user,
) => {
  const ownedIds = await getOwnedMonitorIds(user);
  const monitorFilter = resolveMonitorFilter(ownedIds, monitorId);

  const filter = {};

  if (status === INCIDENT_STATUS_FILTER_ACTIVE) {
    filter.status = { $ne: INCIDENT_STATUS.RESOLVED };
  } else if (status && status !== INCIDENT_STATUS_FILTER_ALL) {
    filter.status = status;
  }
  // status === INCIDENT_STATUS_FILTER_ALL → no status constraint at all.

  if (severity) {
    filter.severity = severity;
  }

  if (startDate && endDate) {
    filter.startedAt = { $gte: startDate, $lte: endDate };
  } else if (window) {
    filter.startedAt = { $gte: msBefore(WINDOW_MS[window]) };
  }

  if (search) {
    const pattern = new RegExp(escapeRegExp(search), "i");
    const matchingMonitorIds = await Monitor.find({
      _id: monitorFilter,
      $or: [{ name: pattern }, { url: pattern }],
    }).distinct("_id");

    filter.$and = [
      { monitor: monitorFilter },
      {
        $or: [
          { monitor: { $in: matchingMonitorIds } },
          { rootCause: pattern },
          { resolutionNotes: pattern },
        ],
      },
    ];
  } else {
    filter.monitor = monitorFilter;
  }

  const sortDirection = order === "asc" ? 1 : -1;
  const skip = (page - 1) * limit;

  const [incidents, total] = await Promise.all([
    Incident.find(filter)
      .populate("monitor", MONITOR_POPULATE_FIELDS)
      .populate("triggerCheck", TRIGGER_CHECK_POPULATE_FIELDS)
      .populate("recoveryCheck", TRIGGER_CHECK_POPULATE_FIELDS)
      .sort({ startedAt: sortDirection })
      .skip(skip)
      .limit(limit)
      .lean(),
    Incident.countDocuments(filter),
  ]);

  return {
    incidents: incidents.map(restoreCheckSnapshots),
    total,
    page,
    totalPages: Math.ceil(total / limit) || 1,
  };
};

// ── Single incident ───────────────────────────────────────────────────────────

export const getIncidentById = async (id, user) => {
  const ownedIds = await getOwnedMonitorIds(user);

  const incident = await Incident.findOne({
    _id: id,
    monitor: { $in: ownedIds },
  })
    .populate("monitor", MONITOR_POPULATE_FIELDS)
    .populate("triggerCheck", TRIGGER_CHECK_DETAIL_POPULATE_FIELDS)
    .populate("recoveryCheck", TRIGGER_CHECK_DETAIL_POPULATE_FIELDS)
    .lean();

  if (!incident) {
    throw ApiError.notFound(`Incident not found with id: ${id}`);
  }

  return restoreCheckSnapshots(incident);
};

// ── Update status ─────────────────────────────────────────────────────────────

export const updateIncidentStatus = async (
  id,
  { status, rootCause, resolutionNotes },
  user,
  { admin = false } = {},
) => {
  const ownedIds = admin ? null : await getOwnedMonitorIds(user);
  const incident = await Incident.findOne({
    _id: id,
    ...(admin ? {} : { monitor: { $in: ownedIds } }),
  }).populate("monitor", admin ? "name url owner" : MONITOR_POPULATE_FIELDS);
  if (!incident) {
    throw ApiError.notFound(`Incident not found with id: ${id}`);
  }

  const previousStatus = incident.status;

  const allowed = ALLOWED_TRANSITIONS[previousStatus] || [];
  if (!allowed.includes(status)) {
    throw ApiError.badRequest(
      `Invalid status transition from "${previousStatus}" to "${status}"`,
    );
  }

  const ownerId = user.id || user._id.toString();
  const monitorName = incident.monitor?.name || "a monitor";

  const logStatusChange = () =>
    logActivity({
      userId: ownerId,
      category: admin
        ? ACTIVITY_CATEGORIES.ADMIN
        : ACTIVITY_CATEGORIES.INCIDENT,
      action: admin
        ? ACTIVITY_ACTIONS.ADMIN_INCIDENT_RESOLVED
        : ACTIVITY_ACTIONS.INCIDENT_STATUS_UPDATED,
      description: `${admin ? "Administrator resolved" : "Marked"} incident on "${monitorName}" as ${status}`,
      entityType: "Incident",
      entityId: incident._id,
      metadata: {
        from: previousStatus,
        to: status,
        ...(admin
          ? {
              targetOwner: String(incident.monitor?.owner || ""),
              reason: resolutionNotes || null,
              rootCause: rootCause || null,
            }
          : {}),
      },
    });

  const changedAt = new Date();
  const set = { status };
  if (rootCause != null) set.rootCause = rootCause;
  if (resolutionNotes != null) set.resolutionNotes = resolutionNotes;
  if (status === INCIDENT_STATUS.RESOLVED) {
    set.endedAt = changedAt;
    set.duration = Math.max(
      0,
      Math.round((changedAt - incident.startedAt) / 1000),
    );
  }
  const updatedIncident = await Incident.findOneAndUpdate(
    { _id: id, status: previousStatus },
    { $set: set, $push: { statusHistory: { status, changedAt } } },
    { returnDocument: "after" },
  );
  if (!updatedIncident) {
    throw ApiError.conflict(
      "This incident changed while you were updating it. Refresh and try again.",
    );
  }
  await logStatusChange();
  await syncIncidentById(
    updatedIncident._id,
    status === INCIDENT_STATUS.RESOLVED ? "resolved" : "updated",
  );
  await createNotification({
    ownerId: incident.monitor?.owner || ownerId,
    type:
      status === INCIDENT_STATUS.RESOLVED
        ? "incident_resolved"
        : "incident_updated",
    title:
      status === INCIDENT_STATUS.RESOLVED
        ? `Incident resolved: ${monitorName}`
        : `Incident update: ${monitorName}`,
    message:
      status === INCIDENT_STATUS.RESOLVED
        ? `The incident for ${monitorName} was marked resolved.`
        : `Incident status changed to ${status}.`,
    priority: incident.severity === "critical" ? "critical" : "high",
    link: "/incidents",
    relatedResource: { resourceType: "Incident", resourceId: incident._id },
  });

  const result = await Incident.findById(updatedIncident._id)
    .populate("monitor", MONITOR_POPULATE_FIELDS)
    .populate("triggerCheck", TRIGGER_CHECK_POPULATE_FIELDS)
    .populate("recoveryCheck", TRIGGER_CHECK_POPULATE_FIELDS)
    .lean();
  return restoreCheckSnapshots(result);
};

// ── Downtime statistics ───────────────────────────────────────────────────────

export const getDowntimeStats = async ({ monitorId, window }, user) => {
  const ownedIds = await getOwnedMonitorIds(user);
  const since = msBefore(WINDOW_MS[window]);

  const matchFilter = {
    startedAt: { $gte: since },
    monitor: resolveMonitorFilter(ownedIds, monitorId),
  };

  const [aggResults, topAffectedMonitors] = await Promise.all([
    Incident.aggregate([
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
          // Per-status breakdown of the "still open" bucket above — used
          // by the Incident History page's downtime summary.
          ongoingOnlyCount: {
            $sum: {
              $cond: [{ $eq: ["$status", INCIDENT_STATUS.ONGOING] }, 1, 0],
            },
          },
          investigatingCount: {
            $sum: {
              $cond: [
                { $eq: ["$status", INCIDENT_STATUS.INVESTIGATING] },
                1,
                0,
              ],
            },
          },
          identifiedCount: {
            $sum: {
              $cond: [{ $eq: ["$status", INCIDENT_STATUS.IDENTIFIED] }, 1, 0],
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
    ]),

    // Top 5 monitors by incident count in the window — a single
    // aggregation (match → group → sort → limit → lookup) rather than N
    // per-monitor queries, so this scales with the window's incident
    // volume rather than the caller's total monitor count.
    Incident.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: "$monitor",
          incidentCount: { $sum: 1 },
          totalDowntime: { $sum: { $ifNull: ["$duration", 0] } },
          criticalCount: {
            $sum: {
              $cond: [{ $eq: ["$severity", INCIDENT_SEVERITY.CRITICAL] }, 1, 0],
            },
          },
        },
      },
      { $sort: { incidentCount: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "monitors",
          localField: "_id",
          foreignField: "_id",
          as: "monitorInfo",
          pipeline: [{ $project: { name: 1, url: 1 } }],
        },
      },
      { $unwind: { path: "$monitorInfo", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          monitorId: "$_id",
          name: "$monitorInfo.name",
          url: "$monitorInfo.url",
          incidentCount: 1,
          totalDowntime: 1,
          criticalCount: 1,
        },
      },
    ]),
  ]);

  const aggResult = aggResults[0];

  const stats = aggResult || {
    totalIncidents: 0,
    resolvedCount: 0,
    ongoingCount: 0,
    ongoingOnlyCount: 0,
    investigatingCount: 0,
    identifiedCount: 0,
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
    byStatus: {
      ongoing: stats.ongoingOnlyCount,
      investigating: stats.investigatingCount,
      identified: stats.identifiedCount,
    },
    topAffectedMonitors,
    window,
  };
};
