import Monitor from "../models/Monitor.js";
import SslInfo from "../models/SslInfo.js";
import ApiError from "../utils/ApiError.js";
import logger from "../utils/logger.js";
import env from "../config/env.js";
import {
  extractHostname,
  isSslEligible,
  performSslCheck,
} from "./sslChecker.js";
import {
  SSL_STATUS,
  DOMAIN_STATUS,
  SSL_STATUS_VALUES,
} from "../constants/sslConstants.js";
import { getOwnedMonitorIds } from "./monitor.service.js";
import { createNotification } from "./notification.service.js";
import {
  NOTIFICATION_TYPES,
  NOTIFICATION_PRIORITIES,
} from "../config/notificationConstants.js";
import { logActivity } from "../utils/activityLogger.js";
import {
  ACTIVITY_CATEGORIES,
  ACTIVITY_ACTIONS,
} from "../config/activityConstants.js";

const resolveOwnerId = (user) => user.id || user._id.toString();

// ─────────────────────────────────────────────
// Notification wiring — private to this module. Both the background
// scheduler (workers/sslScheduler.js) and the manual "check now" endpoint
// funnel through runAndPersistCheck below, so notification copy and the
// "only notify on a state transition" rule live in exactly one place.
// ─────────────────────────────────────────────

const NOTIFIABLE_SSL_STATUSES = new Set([
  SSL_STATUS.EXPIRING_SOON,
  SSL_STATUS.EXPIRED,
  SSL_STATUS.INVALID,
]);

const NOTIFIABLE_DOMAIN_STATUSES = new Set([
  DOMAIN_STATUS.EXPIRING_SOON,
  DOMAIN_STATUS.EXPIRED,
]);

const pluralDays = (n) => `${n} day${n === 1 ? "" : "s"}`;

const sslNotificationCopy = (monitor, status, daysRemaining) => {
  switch (status) {
    case SSL_STATUS.EXPIRING_SOON:
      return {
        type: NOTIFICATION_TYPES.SSL_EXPIRING_SOON,
        title: `${monitor.name}'s SSL certificate is expiring soon`,
        message: `The TLS certificate for "${monitor.name}" expires in ${pluralDays(daysRemaining)}. Renew it to avoid an outage.`,
        priority: NOTIFICATION_PRIORITIES.HIGH,
      };
    case SSL_STATUS.EXPIRED:
      return {
        type: NOTIFICATION_TYPES.SSL_EXPIRED,
        title: `${monitor.name}'s SSL certificate has expired`,
        message: `The TLS certificate for "${monitor.name}" expired ${pluralDays(Math.abs(daysRemaining))} ago.`,
        priority: NOTIFICATION_PRIORITIES.CRITICAL,
      };
    case SSL_STATUS.INVALID:
      return {
        type: NOTIFICATION_TYPES.SSL_INVALID,
        title: `${monitor.name}'s SSL certificate is invalid`,
        message: `WebMonitor could not validate the TLS certificate presented by "${monitor.name}". Check the certificate chain and hostname configuration.`,
        priority: NOTIFICATION_PRIORITIES.CRITICAL,
      };
    default:
      return null;
  }
};

const domainNotificationCopy = (monitor, status, daysRemaining) => {
  switch (status) {
    case DOMAIN_STATUS.EXPIRING_SOON:
      return {
        type: NOTIFICATION_TYPES.DOMAIN_EXPIRING_SOON,
        title: `${monitor.name}'s domain is expiring soon`,
        message: `The domain registration behind "${monitor.name}" expires in ${pluralDays(daysRemaining)}. Renew it to avoid losing the domain.`,
        priority: NOTIFICATION_PRIORITIES.HIGH,
      };
    case DOMAIN_STATUS.EXPIRED:
      return {
        type: NOTIFICATION_TYPES.DOMAIN_EXPIRED,
        title: `${monitor.name}'s domain has expired`,
        message: `The domain registration behind "${monitor.name}" has expired. The site may become unreachable if it isn't renewed.`,
        priority: NOTIFICATION_PRIORITIES.CRITICAL,
      };
    default:
      return null;
  }
};

const maybeNotify = async (
  monitor,
  kind,
  previousStatus,
  nextStatus,
  daysRemaining,
) => {
  if (previousStatus === nextStatus) return; // no transition — never re-notify

  const notifiable =
    kind === "ssl" ? NOTIFIABLE_SSL_STATUSES : NOTIFIABLE_DOMAIN_STATUSES;
  if (!notifiable.has(nextStatus)) return;

  const copy =
    kind === "ssl"
      ? sslNotificationCopy(monitor, nextStatus, daysRemaining)
      : domainNotificationCopy(monitor, nextStatus, daysRemaining);
  if (!copy) return;

  await createNotification({
    ownerId: monitor.owner,
    ...copy,
    link: `/monitors/${monitor._id}`,
    relatedResource: { resourceType: "Monitor", resourceId: monitor._id },
  });
};

// ─────────────────────────────────────────────
// Core check + persist
// ─────────────────────────────────────────────

/**
 * Runs a live SSL + domain check for `monitor`, persists the result onto
 * its SslInfo document, advances the monitor's SSL check schedule, and
 * fires a notification on any status transition into a notifiable state.
 * This is the SINGLE place a check is ever performed and persisted.
 *
 * Callers are expected to have already confirmed `monitor` is HTTPS
 * (workers/sslScheduler.js's due-query already filters for it;
 * triggerManualCheck below validates it explicitly) — a non-HTTPS
 * monitor reaching this function indicates a bug upstream, so it's
 * logged and skipped defensively rather than throwing mid-schedule.
 */
export const runAndPersistCheck = async (monitor) => {
  const hostname = extractHostname(monitor.url);

  if (!hostname || !isSslEligible(monitor.url)) {
    logger.warn(
      `Skipping SSL check for "${monitor.name}" (${monitor._id}) — not an HTTPS monitor`,
    );
    return null;
  }

  const info = await SslInfo.getOrCreateForMonitor(monitor._id, hostname);
  const previousSslStatus = info.status;
  const previousDomainStatus = info.domain?.status || null;
  const port = Number(new URL(monitor.url).port) || 443;

  const { certResult, domainResult, cert, domain } = await performSslCheck(
    hostname,
    port,
  );

  info.hostname = hostname;
  info.status = cert.status;
  info.daysRemaining = cert.daysRemaining;
  info.previousStatus = previousSslStatus;
  info.lastCheckedAt = new Date();
  info.consecutiveFailures = certResult.ok
    ? 0
    : (info.consecutiveFailures || 0) + 1;
  info.lastError = certResult.ok ? null : certResult.error;

  // Preserve the last-known-good certificate snapshot on a transient
  // handshake failure — a single flaky connection shouldn't wipe out
  // otherwise-useful certificate data the UI is displaying.
  if (certResult.ok) {
    info.certificate = {
      valid: certResult.valid,
      selfSigned: certResult.selfSigned,
      validFrom: certResult.validFrom,
      validTo: certResult.validTo,
      issuer: certResult.issuer,
      issuerOrganization: certResult.issuerOrganization,
      subject: certResult.subject,
      subjectAlternativeNames: certResult.subjectAlternativeNames,
      serialNumber: certResult.serialNumber,
      fingerprint: certResult.fingerprint,
      fingerprint256: certResult.fingerprint256,
      signatureAlgorithm: certResult.signatureAlgorithm,
      protocol: certResult.protocol,
      keyBits: certResult.keyBits,
    };
  }

  info.domain = {
    name: domainResult.ok ? domainResult.name : info.domain?.name || hostname,
    registrar: domainResult.ok
      ? domainResult.registrar
      : info.domain?.registrar || null,
    registeredAt: domainResult.ok
      ? domainResult.registeredAt
      : info.domain?.registeredAt || null,
    updatedAt: domainResult.ok
      ? domainResult.updatedAt
      : info.domain?.updatedAt || null,
    expiresAt: domainResult.ok
      ? domainResult.expiresAt
      : info.domain?.expiresAt || null,
    nameServers: domainResult.ok
      ? domainResult.nameServers
      : info.domain?.nameServers || [],
    statuses: domainResult.ok
      ? domainResult.statuses
      : info.domain?.statuses || [],
    status: domain.status,
    daysRemaining: domain.daysRemaining,
    lookupError: domainResult.ok ? null : domainResult.error,
  };

  await info.save();

  await Monitor.findByIdAndUpdate(monitor._id, {
    lastSslCheckedAt: new Date(),
    nextSslCheckAt: new Date(Date.now() + env.SSL_CHECK_INTERVAL_MS),
  });

  await maybeNotify(
    monitor,
    "ssl",
    previousSslStatus,
    cert.status,
    cert.daysRemaining,
  );
  await maybeNotify(
    monitor,
    "domain",
    previousDomainStatus,
    domain.status,
    domain.daysRemaining,
  );

  logger.debug(
    `SSL check for "${monitor.name}" (${hostname}) — ${cert.status}${
      cert.daysRemaining != null ? ` (${cert.daysRemaining}d)` : ""
    }`,
  );

  return info;
};

// ─────────────────────────────────────────────
// User-facing queries and mutations
// ─────────────────────────────────────────────

/**
 * SSL + domain detail for a single monitor, scoped to its owner. Returns
 * an `eligible: false` shape for HTTP-only monitors rather than 404ing —
 * "this monitor has no SSL data because it isn't HTTPS" is a valid,
 * expected response, not a not-found condition.
 */
export const getMonitorSsl = async (monitorId, user) => {
  const ownerId = resolveOwnerId(user);

  const monitor = await Monitor.findOne({ _id: monitorId, owner: ownerId });
  if (!monitor) {
    throw ApiError.notFound(`Monitor not found with id: ${monitorId}`);
  }

  const eligible = isSslEligible(monitor.url);

  const info = eligible
    ? await SslInfo.getOrCreateForMonitor(
        monitor._id,
        extractHostname(monitor.url),
      )
    : null;

  return {
    monitor: {
      id: monitor._id,
      name: monitor.name,
      url: monitor.url,
      active: monitor.active,
      sslMonitoringEnabled: monitor.sslMonitoringEnabled,
      lastSslCheckedAt: monitor.lastSslCheckedAt,
      nextSslCheckAt: monitor.nextSslCheckAt,
    },
    eligible,
    ssl: info
      ? info.toJSON()
      : {
          status: SSL_STATUS.NOT_APPLICABLE,
          daysRemaining: null,
          certificate: null,
          domain: null,
        },
  };
};

const MANUAL_CHECK_COOLDOWN_MS = 60_000;

/**
 * On-demand recheck triggered from the UI. Rate-limited per monitor
 * (independent of the global/auth rate limiters) since every call opens
 * a real outbound TLS connection and an RDAP HTTP request — a "check
 * now" button mashed repeatedly should not be able to turn into a
 * scanning tool against arbitrary third-party hosts.
 */
export const triggerManualCheck = async (monitorId, user) => {
  const ownerId = resolveOwnerId(user);

  const monitor = await Monitor.findOne({ _id: monitorId, owner: ownerId });
  if (!monitor) {
    throw ApiError.notFound(`Monitor not found with id: ${monitorId}`);
  }

  if (!isSslEligible(monitor.url)) {
    throw ApiError.badRequest(
      "SSL monitoring only applies to HTTPS monitors. This monitor's URL uses HTTP.",
    );
  }

  if (
    monitor.lastSslCheckedAt &&
    Date.now() - monitor.lastSslCheckedAt.getTime() < MANUAL_CHECK_COOLDOWN_MS
  ) {
    throw ApiError.badRequest(
      "This monitor's SSL certificate was checked less than a minute ago. Please wait before checking again.",
    );
  }

  const info = await runAndPersistCheck(monitor);
  if (!info) {
    throw ApiError.internal(
      "SSL check could not be completed for this monitor",
    );
  }

  await logActivity({
    userId: ownerId,
    category: ACTIVITY_CATEGORIES.MONITOR,
    action: ACTIVITY_ACTIONS.SSL_CHECK_TRIGGERED,
    description: `Manually checked SSL certificate for "${monitor.name}"`,
    entityType: "Monitor",
    entityId: monitor._id,
    metadata: { status: info.status, daysRemaining: info.daysRemaining },
  });

  return info;
};

/**
 * Enables/disables SSL monitoring for a single monitor. Re-enabling
 * re-arms an immediate check on the next scheduler tick, so toggling it
 * back on doesn't wait out whatever schedule was in place before it was
 * disabled.
 */
export const updateSslMonitoringSetting = async (monitorId, enabled, user) => {
  const ownerId = resolveOwnerId(user);

  const monitor = await Monitor.findOneAndUpdate(
    { _id: monitorId, owner: ownerId },
    {
      sslMonitoringEnabled: enabled,
      ...(enabled ? { nextSslCheckAt: new Date() } : {}),
    },
    { returnDocument: "after", runValidators: true },
  );

  if (!monitor) {
    throw ApiError.notFound(`Monitor not found with id: ${monitorId}`);
  }

  await logActivity({
    userId: ownerId,
    category: ACTIVITY_CATEGORIES.MONITOR,
    action: enabled
      ? ACTIVITY_ACTIONS.SSL_MONITORING_ENABLED
      : ACTIVITY_ACTIONS.SSL_MONITORING_DISABLED,
    description: `${enabled ? "Enabled" : "Disabled"} SSL monitoring for "${monitor.name}"`,
    entityType: "Monitor",
    entityId: monitor._id,
  });

  return monitor;
};

/**
 * Aggregated SSL overview across every monitor the caller owns — status
 * counts, eligibility/coverage counts, and the soonest-expiring
 * certificates and domains. Powers the SSL Monitoring page.
 */
export const getSslOverview = async (user) => {
  const ownedIds = await getOwnedMonitorIds(user);

  const [monitors, sslDocs] = await Promise.all([
    Monitor.find({ _id: { $in: ownedIds } })
      .select("name url active sslMonitoringEnabled lastSslCheckedAt")
      .lean(),
    SslInfo.find({ monitor: { $in: ownedIds } })
      .populate("monitor", "name url active")
      .sort({ daysRemaining: 1 })
      .lean(),
  ]);

  const eligibleMonitors = monitors.filter((m) => isSslEligible(m.url));
  const monitoredCount = eligibleMonitors.filter(
    (m) => m.sslMonitoringEnabled,
  ).length;

  const statusCounts = Object.fromEntries(SSL_STATUS_VALUES.map((s) => [s, 0]));
  for (const doc of sslDocs) {
    if (doc.status in statusCounts) statusCounts[doc.status]++;
  }

  const expiringSoonCertificates = sslDocs
    .filter(
      (d) =>
        d.status === SSL_STATUS.EXPIRING_SOON ||
        d.status === SSL_STATUS.EXPIRED,
    )
    .sort((a, b) => (a.daysRemaining ?? 0) - (b.daysRemaining ?? 0))
    .slice(0, 10);

  const expiringSoonDomains = sslDocs
    .filter(
      (d) =>
        d.domain?.status === DOMAIN_STATUS.EXPIRING_SOON ||
        d.domain?.status === DOMAIN_STATUS.EXPIRED,
    )
    .sort(
      (a, b) => (a.domain?.daysRemaining ?? 0) - (b.domain?.daysRemaining ?? 0),
    )
    .slice(0, 10);

  return {
    totals: {
      totalMonitors: monitors.length,
      eligibleMonitors: eligibleMonitors.length,
      monitoredCount,
      notMonitoredCount: eligibleMonitors.length - monitoredCount,
    },
    statusCounts,
    expiringSoonCertificates,
    expiringSoonDomains,
    monitors: sslDocs,
  };
};
