import Monitor from "../models/Monitor.js";
import Incident from "../models/Incident.js";
import env from "../config/env.js";
import logger from "../utils/logger.js";
import {
  HEALTH_STATUS,
  INCIDENT_STATUS,
  INCIDENT_SEVERITY,
} from "../config/constants.js";
import { createNotification } from "../services/notification.service.js";
import {
  NOTIFICATION_TYPES,
  NOTIFICATION_PRIORITIES,
} from "../config/notificationConstants.js";

const deriveSeverity = (checkStatus) => {
  if (checkStatus === HEALTH_STATUS.DOWN) return INCIDENT_SEVERITY.CRITICAL;
  if (checkStatus === HEALTH_STATUS.DEGRADED) return INCIDENT_SEVERITY.MINOR;
  return INCIDENT_SEVERITY.MAJOR;
};

export const handleIncident = async (monitor, healthCheck) => {
  const isHealthy = healthCheck.status === HEALTH_STATUS.UP;

  if (isHealthy) {
    await handleRecovery(monitor, healthCheck);
  } else {
    await handleFailure(monitor, healthCheck);
  }
};

/**
 * Service recovered: reset consecutive failures and resolve any active incident.
 */
const handleRecovery = async (monitor, healthCheck) => {
  const updatedMonitor = await Monitor.findByIdAndUpdate(monitor._id, {
    $inc: { consecutiveSuccesses: 1 },
    $set: { consecutiveFailures: 0 },
  }, { new: true });
  if ((updatedMonitor?.consecutiveSuccesses || 0) < env.CONSECUTIVE_SUCCESS_THRESHOLD) return;

  // Resolve active incident if one exists
  const activeIncident = await Incident.findActiveForMonitor(monitor._id);
  if (activeIncident) {
    activeIncident.status = INCIDENT_STATUS.RESOLVED;
    activeIncident.endedAt = new Date();
    activeIncident.resolutionNotes = `Auto-resolved: service returned to healthy state. Response time: ${healthCheck.responseTime}ms.`;
    await activeIncident.save(); // pre-save hook computes duration

    logger.info(
      `Incident ${activeIncident._id} resolved for monitor "${monitor.name}" (${activeIncident.durationDisplay})`,
    );

    // Notification failures must never break the polling pipeline —
    // createNotification already swallows and logs its own errors, so no
    // try/catch is needed here.
    await createNotification({
      ownerId: monitor.owner,
      type: NOTIFICATION_TYPES.INCIDENT_RESOLVED,
      title: `${monitor.name} is back up`,
      message: `The incident affecting "${monitor.name}" has been resolved after ${activeIncident.durationDisplay}.`,
      priority: NOTIFICATION_PRIORITIES.NORMAL,
      link: "/insights",
      relatedResource: {
        resourceType: "Incident",
        resourceId: activeIncident._id,
      },
    });
  }
};

/**
 * Service failed: increment counter and open an incident if threshold is met.
 */
const handleFailure = async (monitor, healthCheck) => {
  const updatedMonitor = await Monitor.findByIdAndUpdate(monitor._id, {
    $inc: { consecutiveFailures: 1 },
    $set: { consecutiveSuccesses: 0 },
  }, { new: true });
  const newFailureCount = updatedMonitor?.consecutiveFailures || 1;

  const threshold = env.CONSECUTIVE_FAILURE_THRESHOLD;

  // Only open an incident when the threshold is reached
  if (newFailureCount < threshold) {
    logger.debug(
      `Monitor "${monitor.name}" failure ${newFailureCount}/${threshold} — not yet opening incident`,
    );
    return;
  }

  // Check for existing active incident (prevent duplicates)
  const existing = await Incident.findActiveForMonitor(monitor._id);
  if (existing) {
    logger.debug(
      `Monitor "${monitor.name}" already has active incident ${existing._id} — skipping`,
    );
    return;
  }

  // Open new incident
  const incident = await Incident.create({
    monitor: monitor._id,
    triggerCheck: healthCheck._id,
    status: INCIDENT_STATUS.ONGOING,
    severity: deriveSeverity(healthCheck.status),
    startedAt: new Date(),
    rootCause: healthCheck.failureReason
      ? `Detected failure: ${healthCheck.failureReason}`
      : null,
  });

  logger.warn(
    `Incident ${incident._id} opened for monitor "${monitor.name}" — severity: ${incident.severity}, reason: ${healthCheck.failureReason || "unknown"}`,
  );

  await createNotification({
    ownerId: monitor.owner,
    type: NOTIFICATION_TYPES.INCIDENT_OPENED,
    title: `${monitor.name} is down`,
    message: `WebMonitor detected ${newFailureCount} consecutive failures for "${monitor.name}" — severity: ${incident.severity}.`,
    priority:
      incident.severity === INCIDENT_SEVERITY.CRITICAL
        ? NOTIFICATION_PRIORITIES.CRITICAL
        : NOTIFICATION_PRIORITIES.HIGH,
    link: "/insights",
    relatedResource: { resourceType: "Incident", resourceId: incident._id },
  });
};
