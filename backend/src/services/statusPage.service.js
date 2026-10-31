import StatusPage from "../models/StatusPage.js";
import Monitor from "../models/Monitor.js";
import HealthCheck from "../models/HealthCheck.js";
import DailyStat from "../models/DailyStat.js";
import ApiError from "../utils/ApiError.js";
import { getPlanDefinition } from "../config/plans.js";
import StatusIncident from "../models/StatusIncident.js";
import StatusMaintenance from "../models/StatusMaintenance.js";
import StatusSubscriber from "../models/StatusSubscriber.js";
import User from "../models/User.js";
import env from "../config/env.js";
import logger from "../utils/logger.js";
import { randomBytes } from "node:crypto";
import {
  enqueueBestEffort,
  makeUnsubscribeToken,
  tokenHash,
  verifyUnsubscribeToken,
} from "./statusNotification.service.js";
import { sendStatusVerificationEmail } from "./email.service.js";
import { deleteStatusPageData } from "./statusPageCleanup.service.js";
import {
  calculateOverallStatus,
  mapMonitorStatus,
} from "./statusAggregation.service.js";

const RESERVED = new Set([
  "api",
  "admin",
  "login",
  "register",
  "status",
  "settings",
  "dashboard",
  "monitors",
]);
const id = (value) => String(value?._id || value);
const ownerIdOf = (owner) => owner?._id || owner?.id || owner;
const serialize = (page) => page.toJSON();

export async function list(owner) {
  return (
    await StatusPage.find({ owner: ownerIdOf(owner) }).sort({ createdAt: -1 })
  ).map(serialize);
}
export async function getOwned(pageId, owner) {
  const page = await StatusPage.findOne({
    _id: pageId,
    owner: ownerIdOf(owner),
  });
  if (!page) throw ApiError.notFound("Status page not found");
  return page;
}
export async function create(owner, data) {
  const pageLimit = getPlanDefinition(owner.plan)?.limits.maxStatusPages ?? 0;
  if (
    pageLimit != null &&
    (await StatusPage.countDocuments({ owner: owner._id })) >= pageLimit
  )
    throw ApiError.upgradeRequired("You have reached your status page limit.");
  if (RESERVED.has(data.slug))
    throw ApiError.badRequest("This slug is reserved");
  try {
    return serialize(
      await StatusPage.create({ ...data, owner: ownerIdOf(owner) }),
    );
  } catch (error) {
    if (error.code === 11000)
      throw ApiError.conflict("That status page URL is already in use");
    throw error;
  }
}
export async function update(pageId, owner, data) {
  const page = await getOwned(pageId, owner);
  if (data.slug && RESERVED.has(data.slug))
    throw ApiError.badRequest("This slug is reserved");
  Object.assign(page, data);
  try {
    return serialize(await page.save());
  } catch (error) {
    if (error.code === 11000)
      throw ApiError.conflict("That status page URL is already in use");
    throw error;
  }
}
export async function remove(pageId, owner) {
  await deleteStatusPageData((await getOwned(pageId, owner))._id);
}
export async function setPublished(pageId, owner, publish) {
  const page = await getOwned(pageId, owner);
  page.isPublished = publish;
  page.publishedAt = publish ? new Date() : page.publishedAt;
  const saved = await page.save();
  const visibleServices = page.services
    .filter((service) => service.isVisible)
    .map((service) => service._id);
  if (publish && visibleServices.length)
    await StatusIncident.updateMany(
      {
        statusPage: page._id,
        sourceIncidentId: { $ne: null },
        affectedServices: { $in: visibleServices },
      },
      { $set: { isPublished: true } },
    );
  return serialize(saved);
}
export async function addService(pageId, owner, data) {
  const page = await getOwned(pageId, owner);
  const monitor = await Monitor.findOne({
    _id: data.monitorId,
    owner: ownerIdOf(owner),
  });
  if (!monitor) throw ApiError.notFound("Monitor not found");
  const serviceLimit =
    getPlanDefinition(owner.plan)?.limits.maxStatusServicesPerPage ?? 0;
  const result = await StatusPage.updateOne(
    {
      _id: page._id,
      owner: ownerIdOf(owner),
      "services.monitor": { $ne: monitor._id },
      $expr: { $lt: [{ $size: { $ifNull: ["$services", []] } }, serviceLimit] },
    },
    {
      $push: {
        services: {
          monitor: monitor._id,
          displayName: data.displayName || monitor.name,
          description: data.description || "",
          displayOrder: page.services.length,
          isVisible: data.isVisible ?? true,
        },
      },
    },
  );
  if (!result.modifiedCount) {
    const current = await getOwned(pageId, owner);
    if (
      current.services.some((service) => id(service.monitor) === data.monitorId)
    )
      throw ApiError.conflict("Monitor is already on this page");
    if (current.services.length >= serviceLimit)
      throw ApiError.upgradeRequired(
        "You have reached the service limit for this status page.",
      );
  }
  return serialize(await getOwned(pageId, owner));
}
export async function updateService(pageId, serviceId, owner, data) {
  const page = await getOwned(pageId, owner);
  const service = page.services.id(serviceId);
  if (!service) throw ApiError.notFound("Status page service not found");
  Object.assign(service, data);
  const saved = await page.save();
  if (data.isVisible === false)
    await StatusIncident.updateMany(
      {
        statusPage: page._id,
        sourceIncidentId: { $ne: null },
        affectedServices: service._id,
      },
      {
        $pull: { affectedServices: service._id },
        $set: { isPublished: false },
      },
    );
  return serialize(saved);
}
export async function removeService(pageId, serviceId, owner) {
  const page = await getOwned(pageId, owner);
  const service = page.services.id(serviceId);
  if (!service) throw ApiError.notFound("Status page service not found");
  service.deleteOne();
  page.services.forEach((item, index) => {
    item.displayOrder = index;
  });
  const saved = await page.save();
  await StatusIncident.updateMany(
    {
      statusPage: page._id,
      sourceIncidentId: { $ne: null },
      affectedServices: service._id,
    },
    { $pull: { affectedServices: service._id }, $set: { isPublished: false } },
  );
  return serialize(saved);
}

export async function reorderServices(pageId, owner, serviceIds) {
  const page = await getOwned(pageId, owner);
  const current = page.services.map((item) => String(item._id)).sort();
  const requested = [...serviceIds].sort();
  if (
    current.length !== requested.length ||
    current.some((value, index) => value !== requested[index])
  )
    throw ApiError.badRequest("Provide every service ID exactly once");
  serviceIds.forEach((serviceId, index) => {
    page.services.id(serviceId).displayOrder = index;
  });
  return serialize(await page.save());
}

const assertAffectedServices = (page, serviceIds = []) => {
  const available = new Set(page.services.map((item) => String(item._id)));
  if (serviceIds.some((serviceId) => !available.has(String(serviceId))))
    throw ApiError.badRequest(
      "Affected services must belong to this status page",
    );
};

export async function listIncidents(pageId, owner) {
  const page = await getOwned(pageId, owner);
  const days =
    getPlanDefinition(owner.plan)?.limits.statusIncidentHistoryDays ?? null;
  const since = days == null ? null : new Date(Date.now() - days * 86400000);
  return StatusIncident.find({
    statusPage: page._id,
    ...(since ? { startedAt: { $gte: since } } : {}),
  })
    .sort({ startedAt: -1 })
    .lean();
}
export async function getIncident(pageId, incidentId, owner) {
  const page = await getOwned(pageId, owner);
  const incident = await StatusIncident.findOne({
    _id: incidentId,
    statusPage: page._id,
  });
  if (!incident) throw ApiError.notFound("Incident not found");
  return incident;
}
export async function createIncident(pageId, owner, data) {
  const page = await getOwned(pageId, owner);
  assertAffectedServices(page, data.affectedServices);
  return StatusIncident.create({
    ...data,
    statusPage: page._id,
    createdBy: owner._id,
    startedAt: new Date(),
    updates: [
      {
        message: data.description || "Incident reported",
        status: "investigating",
        author: owner._id,
        authorLabel: owner.name || "Status team",
      },
    ],
  });
}
export async function updateIncident(pageId, incidentId, owner, data) {
  const page = await getOwned(pageId, owner);
  const incident = await StatusIncident.findOne({
    _id: incidentId,
    statusPage: page._id,
  });
  if (!incident) throw ApiError.notFound("Incident not found");
  if (data.affectedServices)
    assertAffectedServices(page, data.affectedServices);
  Object.assign(incident, data);
  return incident.save();
}
export async function addIncidentUpdate(pageId, incidentId, owner, data) {
  const page = await getOwned(pageId, owner);
  const incident = await StatusIncident.findOne({
    _id: incidentId,
    statusPage: page._id,
  });
  if (!incident) throw ApiError.notFound("Incident not found");
  if (incident.status === "resolved")
    throw ApiError.badRequest("Resolved incidents cannot receive new updates");
  const allowedTransitions = {
    investigating: ["identified", "monitoring"],
    identified: ["monitoring"],
    monitoring: ["investigating"],
  };
  if (
    data.status &&
    data.status !== incident.status &&
    !allowedTransitions[incident.status]?.includes(data.status)
  )
    throw ApiError.badRequest(
      `Cannot move an incident from ${incident.status} to ${data.status}`,
    );
  incident.status = data.status || incident.status;
  incident.updates.push({
    message: data.message,
    status: incident.status,
    author: owner._id,
    authorLabel: owner.name || "Status team",
  });
  const saved = await incident.save();
  if (saved.isPublished)
    await enqueueBestEffort(page._id, {
      eventType: "incident_update",
      eventId: `${saved._id}:${saved.updates.at(-1)._id}`,
      subject: `${saved.title}: ${saved.status}`,
      message: data.message,
    });
  return saved;
}
export async function publishIncident(pageId, incidentId, owner) {
  const page = await getOwned(pageId, owner);
  const incident = await StatusIncident.findOne({
    _id: incidentId,
    statusPage: page._id,
  });
  if (!incident) throw ApiError.notFound("Incident not found");
  const wasPublished = incident.isPublished;
  incident.isPublished = true;
  await incident.save();
  if (!wasPublished)
    await enqueueBestEffort(page._id, {
      eventType: "incident_created",
      eventId: incident._id,
      subject: `Incident: ${incident.title}`,
      message:
        incident.description ||
        incident.updates[0]?.message ||
        "An incident has been reported.",
    });
  return incident;
}
export async function resolveIncident(pageId, incidentId, owner, message) {
  const incident = await updateIncident(pageId, incidentId, owner, {
    status: "resolved",
    resolvedAt: new Date(),
  });
  if (message)
    incident.updates.push({
      message,
      status: "resolved",
      author: owner._id,
      authorLabel: owner.name || "Status team",
    });
  const saved = await incident.save();
  if (saved.isPublished)
    await enqueueBestEffort(saved.statusPage, {
      eventType: "incident_resolved",
      eventId: `${saved._id}:resolved`,
      subject: `Resolved: ${saved.title}`,
      message: message || "This incident has been resolved.",
    });
  return saved;
}

export async function listMaintenance(pageId, owner) {
  const page = await getOwned(pageId, owner);
  return StatusMaintenance.find({ statusPage: page._id })
    .sort({ scheduledStart: -1 })
    .lean();
}
export async function createMaintenance(pageId, owner, data) {
  const page = await getOwned(pageId, owner);
  assertAffectedServices(page, data.affectedServices);
  const item = await StatusMaintenance.create({
    ...data,
    statusPage: page._id,
    createdBy: owner._id,
  });
  if (item.isPublished)
    await enqueueBestEffort(page._id, {
      eventType: "maintenance_scheduled",
      eventId: item._id,
      subject: `Maintenance scheduled: ${item.title}`,
      message:
        item.description ||
        `Scheduled for ${item.scheduledStart.toISOString()} to ${item.scheduledEnd.toISOString()}.`,
    });
  return item;
}
export async function updateMaintenance(pageId, itemId, owner, data) {
  const page = await getOwned(pageId, owner);
  const item = await StatusMaintenance.findOne({
    _id: itemId,
    statusPage: page._id,
  });
  if (!item) throw ApiError.notFound("Maintenance window not found");
  const allowedTransitions = {
    scheduled: ["in_progress", "cancelled"],
    in_progress: ["completed", "cancelled"],
    completed: [],
    cancelled: [],
  };
  if (
    data.status &&
    data.status !== item.status &&
    !allowedTransitions[item.status]?.includes(data.status)
  )
    throw ApiError.badRequest(
      `Cannot move maintenance from ${item.status} to ${data.status}`,
    );
  if (data.affectedServices)
    assertAffectedServices(page, data.affectedServices);
  Object.assign(item, data);
  const saved = await item.save();
  if (
    saved.isPublished &&
    Object.keys(data).some((key) =>
      [
        "status",
        "title",
        "description",
        "scheduledStart",
        "scheduledEnd",
        "affectedServices",
      ].includes(key),
    )
  )
    await enqueueBestEffort(page._id, {
      eventType: "maintenance_update",
      eventId: `${saved._id}:${saved.updatedAt.getTime()}`,
      subject: `Maintenance updated: ${saved.title}`,
      message:
        saved.description ||
        `Maintenance is now ${saved.status.replace("_", " ")}.`,
    });
  return saved;
}
export async function removeMaintenance(pageId, itemId, owner) {
  const page = await getOwned(pageId, owner);
  const item = await StatusMaintenance.findOne({
    _id: itemId,
    statusPage: page._id,
  });
  if (!item) throw ApiError.notFound("Maintenance window not found");
  if (["scheduled", "in_progress"].includes(item.status)) {
    item.status = "cancelled";
    await item.save();
    if (item.isPublished)
      await enqueueBestEffort(page._id, {
        eventType: "maintenance_update",
        eventId: `${item._id}:cancelled`,
        subject: `Maintenance cancelled: ${item.title}`,
        message:
          item.description || "This scheduled maintenance has been cancelled.",
      });
    return;
  }
  await item.deleteOne();
}

export async function subscribe(slug, email, preferences = {}) {
  const page = await StatusPage.findOne({ slug, isPublished: true });
  if (!page) return;
  const user = await User.findById(page.owner).select("plan");
  const limit =
    getPlanDefinition(user?.plan)?.limits.maxStatusSubscribersPerPage ?? 0;
  const normalizedEmail = email.trim().toLowerCase();
  const existing = await StatusSubscriber.findOne({
    statusPage: page._id,
    email: normalizedEmail,
  }).select("+unsubscribeTokenHash");
  if (existing?.isVerified && existing.isActive) {
    if (!existing.unsubscribeTokenHash)
      existing.unsubscribeTokenHash = tokenHash(makeUnsubscribeToken(existing));
    await existing.save();
    return;
  }
  if (existing) {
    if (!existing.isActive) {
      const count = await StatusSubscriber.countDocuments({
        statusPage: page._id,
        isActive: true,
      });
      if (count >= limit) return;
      existing.isActive = true;
      existing.isVerified = false;
      existing.preferences = { ...existing.preferences, ...preferences };
    }
    if (preferences && Object.keys(preferences).length)
      existing.preferences = { ...existing.preferences, ...preferences };
    const token = randomBytes(32).toString("base64url");
    existing.verificationTokenHash = tokenHash(token);
    existing.verificationExpiresAt = new Date(Date.now() + 24 * 3600000);
    existing.unsubscribeTokenHash = tokenHash(makeUnsubscribeToken(existing));
    await existing.save();
    try {
      await sendStatusVerificationEmail({
        to: existing.email,
        pageName: page.name,
        verificationUrl: `${env.CLIENT_URL}/status-subscription#token=${encodeURIComponent(token)}&action=verify`,
      });
    } catch {
      logger.warn("Status subscription verification email failed");
    }
    return;
  }
  const count = await StatusSubscriber.countDocuments({
    statusPage: page._id,
    isActive: true,
  });
  if (count >= limit) return;
  const token = randomBytes(32).toString("base64url");
  let subscriber;
  try {
    subscriber = await StatusSubscriber.create({
      statusPage: page._id,
      email: normalizedEmail,
      preferences,
      verificationTokenHash: tokenHash(token),
      verificationExpiresAt: new Date(Date.now() + 24 * 3600000),
    });
  } catch (error) {
    if (error.code === 11000) return;
    throw error;
  }
  subscriber.unsubscribeTokenHash = tokenHash(makeUnsubscribeToken(subscriber));
  await subscriber.save();
  try {
    await sendStatusVerificationEmail({
      to: subscriber.email,
      pageName: page.name,
      verificationUrl: `${env.CLIENT_URL}/status-subscription#token=${encodeURIComponent(token)}&action=verify`,
    });
  } catch {
    logger.warn("Status subscription verification email failed");
  }
}
export async function verifySubscription(token) {
  const subscriber = await StatusSubscriber.findOne({
    verificationTokenHash: tokenHash(token),
    verificationExpiresAt: { $gt: new Date() },
    isActive: true,
  }).select("+verificationTokenHash +verificationExpiresAt");
  if (!subscriber) return false;
  subscriber.isVerified = true;
  subscriber.verifiedAt = new Date();
  subscriber.verificationTokenHash = null;
  subscriber.verificationExpiresAt = null;
  await subscriber.save();
  return true;
}
export async function unsubscribe(token) {
  const subscriber = await verifyUnsubscribeToken(token);
  if (!subscriber) return false;
  subscriber.isActive = false;
  await subscriber.save();
  return true;
}
export async function subscriberStats(pageId, owner) {
  const page = await getOwned(pageId, owner);
  const [active, pending] = await Promise.all([
    StatusSubscriber.countDocuments({
      statusPage: page._id,
      isVerified: true,
      isActive: true,
    }),
    StatusSubscriber.countDocuments({
      statusPage: page._id,
      isVerified: false,
      isActive: true,
    }),
  ]);
  return {
    active,
    pending,
    limit:
      getPlanDefinition(owner.plan)?.limits.maxStatusSubscribersPerPage ?? 0,
  };
}

export async function getPublic(slug, window = "90d") {
  const page = await StatusPage.findOne({ slug, isPublished: true })
    .populate({
      path: "services.monitor",
      select: "owner active interval lastCheckedAt consecutiveFailures",
    })
    .lean();
  if (!page) throw ApiError.notFound("Status page not found");
  return buildPublicStatus(page, window);
}

export async function getPreview(id, owner, window = "90d") {
  const owned = await getOwned(id, owner);
  const page = await StatusPage.findById(owned._id)
    .populate({
      path: "services.monitor",
      select: "owner active interval lastCheckedAt consecutiveFailures",
    })
    .lean();
  return { ...(await buildPublicStatus(page, window)), isPreview: true };
}

async function buildPublicStatus(page, window) {
  const services = (page.services || [])
    .filter(
      (service) =>
        service.isVisible &&
        service.monitor &&
        String(service.monitor.owner) === String(page.owner),
    )
    .sort((a, b) => a.displayOrder - b.displayOrder);
  const monitorIds = services.map((service) => service.monitor._id);
  const publicOwner = await User.findById(page.owner).select("plan").lean();
  const incidentHistoryDays =
    getPlanDefinition(publicOwner?.plan)?.limits.statusIncidentHistoryDays ??
    null;
  const incidentSince =
    incidentHistoryDays == null
      ? null
      : new Date(Date.now() - incidentHistoryDays * 86400000);
  const windowMs =
    {
      "24h": 86400000,
      "7d": 7 * 86400000,
      "30d": 30 * 86400000,
      "90d": 90 * 86400000,
    }[window] || 90 * 86400000;
  const since = new Date(Date.now() - windowMs);
  const [uptimeRows, maintenanceRecords, incidentRecords] = await Promise.all([
    monitorIds.length
      ? DailyStat.aggregate([
          { $match: { monitor: { $in: monitorIds }, date: { $gte: since } } },
          {
            $group: {
              _id: "$monitor",
              total: { $sum: "$totalChecks" },
              successful: { $sum: "$successfulChecks" },
              firstDate: { $min: "$date" },
            },
          },
        ])
      : [],
    StatusMaintenance.find({
      statusPage: page._id,
      isPublished: true,
      status: { $in: ["scheduled", "in_progress"] },
      scheduledEnd: { $gt: new Date() },
    })
      .sort({ scheduledStart: 1 })
      .limit(30)
      .lean(),
    StatusIncident.find({
      statusPage: page._id,
      isPublished: true,
      ...(incidentSince ? { startedAt: { $gte: incidentSince } } : {}),
    })
      .sort({ startedAt: -1 })
      .limit(30)
      .lean(),
  ]);
  const now = new Date();
  const uptimeByMonitor = new Map(
    uptimeRows.map((row) => [
      String(row._id),
      {
        percentage: row.total
          ? Number(((row.successful / row.total) * 100).toFixed(2))
          : null,
        days: row.firstDate
          ? Math.max(1, Math.ceil((now - new Date(row.firstDate)) / 86400000))
          : 0,
      },
    ]),
  );
  const activeMaintenance = maintenanceRecords.filter(
    (item) =>
      item.scheduledEnd > now &&
      (item.status === "in_progress" ||
        (item.status === "scheduled" && item.scheduledStart <= now)),
  );
  const activeIncidents = incidentRecords.filter(
    (item) => item.status !== "resolved",
  );
  const snapshots = await Promise.all(
    services.map(async (service) => {
      const monitor = service.monitor;
      const check = await HealthCheck.findOne({ monitor: monitor._id })
        .sort({ checkedAt: -1 })
        .select("status checkedAt")
        .lean();
      const stale =
        !check ||
        Date.now() - new Date(check.checkedAt).getTime() >
          (monitor.interval || 300) * 3000;
      const status = mapMonitorStatus({
        active: monitor.active,
        stale,
        status: check?.status,
        consecutiveFailures: monitor.consecutiveFailures,
        failureThreshold: env.CONSECUTIVE_FAILURE_THRESHOLD,
      });
      const isInMaintenance = activeMaintenance.some((item) =>
        item.affectedServices.some(
          (serviceId) => String(serviceId) === String(service._id),
        ),
      );
      const affectingIncident = activeIncidents.find((item) =>
        item.affectedServices.some(
          (serviceId) => String(serviceId) === String(service._id),
        ),
      );
      const incidentStatus = affectingIncident
        ? {
            critical: "major_outage",
            major: "partial_outage",
            minor: "degraded",
          }[affectingIncident.severity] || "degraded"
        : null;
      const servicePrecedence = [
        "major_outage",
        "partial_outage",
        "degraded",
        "maintenance",
        "unknown",
        "operational",
      ];
      const candidates = [
        status,
        incidentStatus,
        isInMaintenance ? "maintenance" : null,
      ].filter(Boolean);
      const publicStatus = candidates.sort(
        (a, b) => servicePrecedence.indexOf(a) - servicePrecedence.indexOf(b),
      )[0];
      const uptime =
        window === "24h"
          ? {
              percentage: await HealthCheck.uptimePercent(
                monitor._id,
                windowMs,
              ),
              days: 1,
            }
          : uptimeByMonitor.get(String(monitor._id));
      return {
        name: service.displayName,
        description: service.description,
        status: publicStatus,
        uptimePercentage: uptime?.percentage ?? null,
        uptimeDays: uptime?.days || 0,
        uptimeWindow: window,
        lastCheckedAt: check?.checkedAt || null,
      };
    }),
  );
  const status = calculateOverallStatus(
    snapshots.map((item) => item.status),
    activeIncidents,
  );
  const allMaintenanceRecords = await StatusMaintenance.find({
    statusPage: page._id,
    isPublished: true,
    status: { $ne: "cancelled" },
  })
    .sort({ scheduledStart: -1 })
    .limit(30)
    .lean();
  const serviceNames = new Map(
    services.map((service) => [String(service._id), service.displayName]),
  );
  const incidents = incidentRecords.map(
    ({
      title,
      description,
      severity,
      status: state,
      affectedServices,
      updates,
      startedAt,
      resolvedAt,
    }) => ({
      title,
      description,
      severity,
      status: state,
      affectedServices: affectedServices
        .map((serviceId) => serviceNames.get(String(serviceId)))
        .filter(Boolean),
      updates: updates.map(
        ({ message, status: updateStatus, authorLabel, createdAt }) => ({
          message,
          status: updateStatus,
          author: authorLabel,
          createdAt,
        }),
      ),
      startedAt,
      resolvedAt,
    }),
  );
  const maintenance = allMaintenanceRecords.map(
    ({
      title,
      description,
      affectedServices,
      scheduledStart,
      scheduledEnd,
      status: state,
    }) => ({
      title,
      description,
      affectedServices: affectedServices
        .map((serviceId) => serviceNames.get(String(serviceId)))
        .filter(Boolean),
      scheduledStart,
      scheduledEnd,
      status:
        ["scheduled", "in_progress"].includes(state) && scheduledEnd <= now
          ? "completed"
          : state === "scheduled" && scheduledStart <= now
            ? "in_progress"
            : state,
      timezone: page.timezone,
    }),
  );
  const lastUpdatedAt = Math.max(
    page.updatedAt ? new Date(page.updatedAt).getTime() : 0,
    ...snapshots.map((item) =>
      item.lastCheckedAt ? new Date(item.lastCheckedAt).getTime() : 0,
    ),
    ...incidentRecords.map((item) =>
      item.updatedAt ? new Date(item.updatedAt).getTime() : 0,
    ),
    ...allMaintenanceRecords.map((item) =>
      item.updatedAt ? new Date(item.updatedAt).getTime() : 0,
    ),
  );
  return {
    name: page.name,
    slug: page.slug,
    description: page.description,
    logo: page.logo,
    branding: page.branding,
    timezone: page.timezone,
    status,
    updatedAt: new Date(lastUpdatedAt || now.getTime()),
    services: snapshots,
    incidents,
    maintenance,
  };
}
