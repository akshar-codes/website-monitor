import Monitor from "../models/Monitor.js";
import Incident from "../models/Incident.js";
import env from "../config/env.js";
import logger from "../utils/logger.js";
import { logActivity } from "../utils/activityLogger.js";
import { ACTIVITY_ACTIONS, ACTIVITY_CATEGORIES } from "../config/activityConstants.js";
import { HEALTH_STATUS, INCIDENT_STATUS, INCIDENT_SEVERITY } from "../config/constants.js";
import { createNotification } from "../services/notification.service.js";
import { NOTIFICATION_TYPES, NOTIFICATION_PRIORITIES } from "../config/notificationConstants.js";

const ACTIVE_STATUSES = [
  INCIDENT_STATUS.ONGOING,
  INCIDENT_STATUS.INVESTIGATING,
  INCIDENT_STATUS.IDENTIFIED,
];

const deriveSeverity = (status) => {
  if (status === HEALTH_STATUS.DOWN) return INCIDENT_SEVERITY.CRITICAL;
  if (status === HEALTH_STATUS.DEGRADED) return INCIDENT_SEVERITY.MINOR;
  return INCIDENT_SEVERITY.MAJOR;
};

const writeActivity = (monitor, incident, action, description, metadata, deps) =>
  deps.logActivity({
    userId: monitor.owner,
    category: ACTIVITY_CATEGORIES.INCIDENT,
    action,
    description,
    entityType: "Incident",
    entityId: incident._id,
    metadata,
  });

const notify = (args, deps) => deps.createNotification(args);

const openIncident = async (monitor, healthCheck, failureCount, deps) => {
  const startedAt = healthCheck.checkedAt || new Date();
  const incident = {
    monitor: monitor._id,
    triggerCheck: healthCheck._id,
    status: INCIDENT_STATUS.ONGOING,
    severity: deriveSeverity(healthCheck.status),
    startedAt,
    rootCause: healthCheck.failureReason
      ? `Detected failure: ${healthCheck.failureReason}`
      : "Monitor reported an unhealthy result.",
    statusHistory: [{ status: INCIDENT_STATUS.ONGOING, changedAt: startedAt }],
  };

  let created = false;
  try {
    const result = await deps.Incident.updateOne(
      { monitor: monitor._id, status: { $in: ACTIVE_STATUSES } },
      { $setOnInsert: incident },
      { upsert: true },
    );
    created = result.upsertedCount === 1 || Boolean(result.upsertedId);
  } catch (error) {
    // A concurrent upsert may win the unique active-incident index. Continue
    // by loading that incident; only the winner emits the transition event.
    if (error.code !== 11000) throw error;
  }

  const activeIncident = await deps.Incident.findOne({
    monitor: monitor._id,
    status: { $in: ACTIVE_STATUSES },
  }).sort({ startedAt: -1 });
  if (!activeIncident || !created) return activeIncident;

  logger.warn("Incident opened", {
    incidentId: String(activeIncident._id),
    monitorId: String(monitor._id),
    failureCount,
    severity: activeIncident.severity,
    triggerCheckId: String(healthCheck._id),
  });
  await writeActivity(
    monitor,
    activeIncident,
    ACTIVITY_ACTIONS.INCIDENT_AUTO_OPENED,
    `Incident opened for monitor "${monitor.name}" after ${failureCount} consecutive failures`,
    { monitorId: String(monitor._id), triggerCheckId: String(healthCheck._id), failureReason: healthCheck.failureReason || null },
    deps,
  );
  await notify({
    ownerId: monitor.owner,
    type: NOTIFICATION_TYPES.INCIDENT_OPENED,
    title: `${monitor.name} is down`,
    message: `WebMonitor detected ${failureCount} consecutive failures for "${monitor.name}" — severity: ${activeIncident.severity}.`,
    priority: activeIncident.severity === INCIDENT_SEVERITY.CRITICAL
      ? NOTIFICATION_PRIORITIES.CRITICAL
      : NOTIFICATION_PRIORITIES.HIGH,
    link: "/insights",
    relatedResource: { resourceType: "Incident", resourceId: activeIncident._id },
  }, deps);
  return activeIncident;
};

const resolveIncident = async (monitor, healthCheck, deps) => {
  const activeIncident = await deps.Incident.findOne({
    monitor: monitor._id,
    status: { $in: ACTIVE_STATUSES },
  }).sort({ startedAt: -1 });
  if (!activeIncident) return null;

  const endedAt = healthCheck.checkedAt || new Date();
  const duration = Math.max(0, Math.round((endedAt - activeIncident.startedAt) / 1000));
  const resolved = await deps.Incident.findOneAndUpdate(
    { _id: activeIncident._id, status: { $in: ACTIVE_STATUSES } },
    {
      $set: {
        status: INCIDENT_STATUS.RESOLVED,
        endedAt,
        duration,
        recoveryCheck: healthCheck._id,
        resolutionNotes: `Auto-resolved after ${env.CONSECUTIVE_SUCCESS_THRESHOLD} consecutive healthy checks.`,
      },
      $push: { statusHistory: { status: INCIDENT_STATUS.RESOLVED, changedAt: endedAt } },
    },
    { new: true },
  );
  // The active-status predicate makes this transition single-winner. A retry
  // or competing worker cannot emit duplicate events after it has resolved.
  if (!resolved) return null;

  logger.info("Incident resolved", {
    incidentId: String(resolved._id),
    monitorId: String(monitor._id),
    durationSeconds: resolved.duration,
    recoveryCheckId: String(healthCheck._id),
  });
  await writeActivity(
    monitor,
    resolved,
    ACTIVITY_ACTIONS.INCIDENT_AUTO_RESOLVED,
    `Incident for monitor "${monitor.name}" auto-resolved after consecutive healthy checks`,
    { monitorId: String(monitor._id), recoveryCheckId: String(healthCheck._id), durationSeconds: resolved.duration },
    deps,
  );
  await notify({
    ownerId: monitor.owner,
    type: NOTIFICATION_TYPES.INCIDENT_RESOLVED,
    title: `${monitor.name} is back up`,
    message: `The incident affecting "${monitor.name}" has been resolved after ${resolved.durationDisplay || `${resolved.duration}s`}.`,
    priority: NOTIFICATION_PRIORITIES.NORMAL,
    link: "/insights",
    relatedResource: { resourceType: "Incident", resourceId: resolved._id },
  }, deps);
  return resolved;
};

/**
 * Apply one persisted health check exactly once to the monitor's failure or
 * recovery streak. The check ID guard survives retries and process restarts.
 */
export const handleIncident = async (monitor, healthCheck, overrides = {}) => {
  const deps = {
    Monitor,
    Incident,
    logActivity,
    createNotification,
    ...overrides,
  };
  const isHealthy = healthCheck.status === HEALTH_STATUS.UP;
  let updatedMonitor = await deps.Monitor.findOneAndUpdate(
    { _id: monitor._id, lastIncidentCheckId: { $ne: healthCheck._id } },
    isHealthy
      ? {
          $inc: { consecutiveSuccesses: 1 },
          $set: { consecutiveFailures: 0, lastIncidentCheckId: healthCheck._id },
        }
      : {
          $inc: { consecutiveFailures: 1 },
          $set: { consecutiveSuccesses: 0, lastIncidentCheckId: healthCheck._id },
        },
    { new: true },
  );

  // If this persisted check was already counted, continue reconciling its
  // threshold transition. This closes the crash window between counter write
  // and incident write without counting the same check twice.
  if (!updatedMonitor) {
    updatedMonitor = await deps.Monitor.findById(monitor._id).select("+lastIncidentCheckId");
    if (!updatedMonitor || String(updatedMonitor.lastIncidentCheckId) !== String(healthCheck._id)) return null;
  }

  if (isHealthy) {
    if (updatedMonitor.consecutiveSuccesses < env.CONSECUTIVE_SUCCESS_THRESHOLD) return null;
    return resolveIncident(monitor, healthCheck, deps);
  }

  if (updatedMonitor.consecutiveFailures < env.CONSECUTIVE_FAILURE_THRESHOLD) {
    logger.debug("Incident threshold not reached", {
      monitorId: String(monitor._id),
      failureCount: updatedMonitor.consecutiveFailures,
      threshold: env.CONSECUTIVE_FAILURE_THRESHOLD,
    });
    return null;
  }
  return openIncident(monitor, healthCheck, updatedMonitor.consecutiveFailures, deps);
};
