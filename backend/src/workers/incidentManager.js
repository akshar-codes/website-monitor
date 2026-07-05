const Monitor = require("../models/Monitor");
const Incident = require("../models/Incident");
const env = require("../config/env");
const logger = require("../utils/logger");

const { STATUS, SEVERITY } = Incident;

const deriveSeverity = (checkStatus) => {
  if (checkStatus === "down") return SEVERITY.CRITICAL;
  if (checkStatus === "degraded") return SEVERITY.MINOR;
  return SEVERITY.MAJOR;
};

const handleIncident = async (monitor, healthCheck) => {
  const isHealthy = healthCheck.status === "up";

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
  // Reset consecutive failures
  if (monitor.consecutiveFailures > 0) {
    await Monitor.findByIdAndUpdate(monitor._id, {
      consecutiveFailures: 0,
    });
  }

  // Resolve active incident if one exists
  const activeIncident = await Incident.findActiveForMonitor(monitor._id);
  if (activeIncident) {
    activeIncident.status = STATUS.RESOLVED;
    activeIncident.endedAt = new Date();
    activeIncident.resolutionNotes = `Auto-resolved: service returned to healthy state. Response time: ${healthCheck.responseTime}ms.`;
    await activeIncident.save(); // pre-save hook computes duration

    logger.info(
      `Incident ${activeIncident._id} resolved for monitor "${monitor.name}" (${activeIncident.durationDisplay})`,
    );
  }
};

/**
 * Service failed: increment counter and open an incident if threshold is met.
 */
const handleFailure = async (monitor, healthCheck) => {
  const newFailureCount = monitor.consecutiveFailures + 1;

  await Monitor.findByIdAndUpdate(monitor._id, {
    consecutiveFailures: newFailureCount,
  });

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
    status: STATUS.ONGOING,
    severity: deriveSeverity(healthCheck.status),
    startedAt: new Date(),
    rootCause: healthCheck.failureReason
      ? `Detected failure: ${healthCheck.failureReason}`
      : null,
  });

  logger.warn(
    `Incident ${incident._id} opened for monitor "${monitor.name}" — severity: ${incident.severity}, reason: ${healthCheck.failureReason || "unknown"}`,
  );
};

module.exports = { handleIncident };
