import mongoose from "mongoose";
import Monitor from "../models/Monitor.js";
import HealthCheck from "../models/HealthCheck.js";
import Incident from "../models/Incident.js";
import DailyStat from "../models/DailyStat.js";
import User from "../models/User.js";
import ApiError from "../utils/ApiError.js";
import {
  HEALTH_STATUS,
  INCIDENT_STATUS,
  INCIDENT_STATUS_FILTER_ACTIVE,
} from "../config/constants.js";
import { escapeRegExp } from "../utils/regex.js";
import * as incidentService from "./incident.service.js";
import { runMonitorCheck } from "../workers/scheduler.js";

const activeIncidentStatuses = [
  INCIDENT_STATUS.ONGOING,
  INCIDENT_STATUS.INVESTIGATING,
  INCIDENT_STATUS.IDENTIFIED,
];
const getIncidentDurationSeconds = (incident) =>
  incident.duration ??
  (incident.status === INCIDENT_STATUS.RESOLVED || !incident.startedAt
    ? null
    : Math.max(
        0,
        Math.floor(
          (Date.now() - new Date(incident.startedAt).getTime()) / 1000,
        ),
      ));
const sensitiveHeaderPattern =
  /(auth|cookie|token|secret|api[-_]?key|password)/i;
const safeUrl = (value) => {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    parsed.username = "";
    parsed.password = "";
    for (const key of [...parsed.searchParams.keys()])
      if (/(token|key|secret|auth|signature|password)/i.test(key))
        parsed.searchParams.delete(key);
    return parsed.href;
  } catch {
    return null;
  }
};
const safeDiagnostics = (diagnostics = {}) => {
  const headers = Object.fromEntries(
    Object.entries(diagnostics.headers || {}).filter(
      ([name]) =>
        !sensitiveHeaderPattern.test(name) && name.toLowerCase() !== "location",
    ),
  );
  const redirects = (diagnostics.redirects || []).map((item) => ({
    ...item,
    url: safeUrl(item.url),
    location: safeUrl(item.location),
  }));
  return {
    statusText: diagnostics.statusText || null,
    finalUrl: safeUrl(diagnostics.finalUrl),
    headers,
    redirects,
    dns: diagnostics.dns || null,
    timing: diagnostics.timing || null,
    errorCode: diagnostics.errorCode || null,
  };
};
const safeCheck = (check) => ({
  id: String(check._id),
  status: check.status,
  httpStatus: check.httpStatus,
  responseTime: check.responseTime,
  failureReason: check.failureReason,
  checkedAt: check.checkedAt,
  diagnostics: safeDiagnostics(check.diagnostics),
});
const paginateFacet = async (pipeline, page, limit) => {
  const [result] = await Monitor.aggregate([
    ...pipeline,
    {
      $facet: {
        data: [{ $skip: (page - 1) * limit }, { $limit: limit }],
        total: [{ $count: "value" }],
      },
    },
  ]);
  return { rows: result?.data || [], total: result?.total?.[0]?.value || 0 };
};

export const listAdminMonitors = async ({
  page,
  limit,
  search,
  ownerId,
  plan,
  status,
  incidentState,
}) => {
  const match = {};
  if (ownerId) match.owner = new mongoose.Types.ObjectId(ownerId);
  if (status === "active") match.active = true;
  if (status === "paused") match.active = false;
  if (search)
    match.$or = [
      { name: new RegExp(escapeRegExp(search), "i") },
      { url: new RegExp(escapeRegExp(search), "i") },
    ];
  const pipeline = [
    { $match: match },
    {
      $lookup: {
        from: User.collection.name,
        localField: "owner",
        foreignField: "_id",
        pipeline: [
          { $project: { name: 1, email: 1, plan: 1, role: 1, active: 1 } },
        ],
        as: "ownerInfo",
      },
    },
    { $unwind: { path: "$ownerInfo", preserveNullAndEmptyArrays: true } },
    ...(plan ? [{ $match: { "ownerInfo.plan": plan } }] : []),
    {
      $lookup: {
        from: HealthCheck.collection.name,
        let: { monitorId: "$_id" },
        pipeline: [
          { $match: { $expr: { $eq: ["$monitor", "$$monitorId"] } } },
          { $sort: { checkedAt: -1 } },
          { $limit: 1 },
          {
            $project: {
              status: 1,
              responseTime: 1,
              failureReason: 1,
              checkedAt: 1,
            },
          },
        ],
        as: "latestCheck",
      },
    },
    { $unwind: { path: "$latestCheck", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: Incident.collection.name,
        let: { monitorId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$monitor", "$$monitorId"] },
              status: { $in: activeIncidentStatuses },
            },
          },
          { $limit: 1 },
          { $project: { _id: 1 } },
        ],
        as: "activeIncident",
      },
    },
    ...(Object.values(HEALTH_STATUS).includes(status)
      ? [{ $match: { "latestCheck.status": status } }]
      : []),
    ...(incidentState === "active"
      ? [{ $match: { "activeIncident.0": { $exists: true } } }]
      : []),
    ...(incidentState === "none"
      ? [{ $match: { "activeIncident.0": { $exists: false } } }]
      : []),
    ...(incidentState === "resolved"
      ? [
          {
            $lookup: {
              from: Incident.collection.name,
              let: { monitorId: "$_id" },
              pipeline: [
                {
                  $match: {
                    $expr: { $eq: ["$monitor", "$$monitorId"] },
                    status: INCIDENT_STATUS.RESOLVED,
                  },
                },
                { $limit: 1 },
                { $project: { _id: 1 } },
              ],
              as: "resolvedIncident",
            },
          },
          { $match: { "resolvedIncident.0": { $exists: true } } },
        ]
      : []),
    { $sort: { updatedAt: -1, _id: 1 } },
    {
      $project: {
        _id: 1,
        name: 1,
        url: 1,
        interval: 1,
        active: 1,
        lastCheckedAt: 1,
        createdAt: 1,
        owner: {
          id: "$ownerInfo._id",
          name: "$ownerInfo.name",
          email: "$ownerInfo.email",
          plan: "$ownerInfo.plan",
          active: "$ownerInfo.active",
        },
        latestCheck: 1,
        hasActiveIncident: { $gt: [{ $size: "$activeIncident" }, 0] },
      },
    },
  ];
  const { rows, total } = await paginateFacet(pipeline, page, limit);
  return {
    monitors: rows.map((row) => ({
      ...row,
      id: String(row._id),
      _id: undefined,
      url: safeUrl(row.url),
      latestCheck: row.latestCheck
        ? {
            status: row.latestCheck.status,
            responseTime: row.latestCheck.responseTime,
            failureReason: row.latestCheck.failureReason,
            checkedAt: row.latestCheck.checkedAt,
          }
        : null,
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit) || 1,
  };
};

export const getAdminMonitorDetail = async (id, window) => {
  const monitor = await Monitor.findById(id)
    .select(
      "owner name url interval active sslMonitoringEnabled lastCheckedAt lastSslCheckedAt createdAt updatedAt",
    )
    .populate("owner", "name email plan role active")
    .lean();
  if (!monitor) throw ApiError.notFound(`Monitor not found with id: ${id}`);
  const start = new Date(
    Date.now() -
      {
        "24h": 86400000,
        "7d": 7 * 86400000,
        "30d": 30 * 86400000,
        "90d": 90 * 86400000,
      }[window],
  );
  const [checks, stats, incidents] = await Promise.all([
    HealthCheck.find({ monitor: id })
      .sort({ checkedAt: -1 })
      .limit(20)
      .select(
        "status httpStatus responseTime failureReason checkedAt diagnostics",
      )
      .lean(),
    DailyStat.aggregate([
      {
        $match: {
          monitor: new mongoose.Types.ObjectId(id),
          date: { $gte: start },
        },
      },
      {
        $group: {
          _id: null,
          totalChecks: { $sum: "$totalChecks" },
          successfulChecks: { $sum: "$successfulChecks" },
          failedChecks: { $sum: "$failedChecks" },
          averageResponseTime: { $avg: "$avgResponseTime" },
          downtimeSeconds: { $sum: "$downtimeSeconds" },
          uptimePercentage: { $avg: "$uptimePercentage" },
        },
      },
    ]),
    Incident.find({ monitor: id })
      .sort({ startedAt: -1 })
      .limit(20)
      .select(
        "startedAt endedAt duration status severity rootCause resolutionNotes statusHistory triggerCheck",
      )
      .populate(
        "triggerCheck",
        "status responseTime httpStatus failureReason checkedAt",
      )
      .lean(),
  ]);
  const stat = stats[0] || {
    totalChecks: 0,
    successfulChecks: 0,
    failedChecks: 0,
    averageResponseTime: 0,
    downtimeSeconds: 0,
    uptimePercentage: null,
  };
  return {
    monitor: {
      id: String(monitor._id),
      name: monitor.name,
      url: safeUrl(monitor.url),
      interval: monitor.interval,
      active: monitor.active,
      sslMonitoringEnabled: monitor.sslMonitoringEnabled,
      lastCheckedAt: monitor.lastCheckedAt,
      lastSslCheckedAt: monitor.lastSslCheckedAt,
      createdAt: monitor.createdAt,
      updatedAt: monitor.updatedAt,
      owner: monitor.owner
        ? {
            id: String(monitor.owner._id),
            name: monitor.owner.name,
            email: monitor.owner.email,
            plan: monitor.owner.plan,
            active: monitor.owner.active,
          }
        : null,
    },
    window,
    uptime: {
      ...stat,
      uptimePercentage:
        stat.uptimePercentage == null
          ? null
          : Number(stat.uptimePercentage.toFixed(2)),
    },
    recentChecks: checks.map(safeCheck),
    incidentHistory: incidents.map((incident) => ({
      id: String(incident._id),
      startedAt: incident.startedAt,
      endedAt: incident.endedAt,
      duration: getIncidentDurationSeconds(incident),
      status: incident.status,
      severity: incident.severity,
      rootCause: incident.rootCause,
      resolutionNotes: incident.resolutionNotes,
      statusHistory: incident.statusHistory,
      triggerCheck: incident.triggerCheck,
    })),
  };
};

export const listAdminIncidents = async ({
  page,
  limit,
  search,
  severity,
  status,
}) => {
  const match = {};
  if (severity) match.severity = severity;
  if (status) match.status = status;
  if (search) {
    const pattern = new RegExp(escapeRegExp(search), "i");
    const matchingMonitors = await Monitor.find({
      $or: [{ name: pattern }, { url: pattern }],
    }).distinct("_id");
    match.$or = [
      { monitor: { $in: matchingMonitors } },
      { rootCause: pattern },
      { resolutionNotes: pattern },
    ];
  }
  const skip = (page - 1) * limit;
  const [incidents, total] = await Promise.all([
    Incident.find(match)
      .populate({
        path: "monitor",
        select: "name url owner",
        populate: { path: "owner", select: "name email plan" },
      })
      .populate(
        "triggerCheck",
        "status responseTime httpStatus failureReason checkedAt",
      )
      .sort({ startedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Incident.countDocuments(match),
  ]);
  return {
    incidents: incidents.map((item) => ({
      ...item,
      duration: getIncidentDurationSeconds(item),
      monitor: item.monitor
        ? { ...item.monitor, url: safeUrl(item.monitor.url) }
        : null,
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit) || 1,
  };
};

export const getAdminIncidentDetail = async (id) => {
  const incident = await Incident.findById(id)
    .populate({
      path: "monitor",
      select: "name url owner",
      populate: { path: "owner", select: "name email plan" },
    })
    .populate(
      "triggerCheck",
      "status responseTime httpStatus failureReason checkedAt",
    )
    .lean();
  if (!incident) throw ApiError.notFound(`Incident not found with id: ${id}`);
  return {
    ...incident,
    duration: getIncidentDurationSeconds(incident),
    monitor: incident.monitor
      ? { ...incident.monitor, url: safeUrl(incident.monitor.url) }
      : null,
  };
};

export const runAdminMonitorCheck = async (id, admin) => {
  const check = await runMonitorCheck(id, admin);
  if (!check)
    throw ApiError.conflict(
      "A check for this monitor is already in progress or the monitor no longer exists.",
    );
  return safeCheck(check);
};

export const resolveAdminIncident = async (id, data, admin) => {
  const resolved = await incidentService.updateIncidentStatus(
    id,
    { status: INCIDENT_STATUS.RESOLVED, ...data },
    admin,
    { admin: true },
  );
  return {
    ...resolved,
    monitor: resolved.monitor
      ? { ...resolved.monitor, url: safeUrl(resolved.monitor.url) }
      : null,
  };
};
