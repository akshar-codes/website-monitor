import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import mongoose from "mongoose";
import DeploymentIntegration from "../models/DeploymentIntegration.js";
import DeploymentEvent from "../models/DeploymentEvent.js";
import Monitor from "../models/Monitor.js";
import HealthCheck from "../models/HealthCheck.js";
import Incident from "../models/Incident.js";
import DeploymentAlertState from "../models/DeploymentAlertState.js";
import User from "../models/User.js";
import ApiError from "../utils/ApiError.js";
import env from "../config/env.js";
import { PLANS, ROLES, WINDOW_MS, HEALTH_STATUS } from "../config/constants.js";
import { getPlanDefinition } from "../config/plans.js";
import { expireSubscriptionIfDue } from "./subscriptionLifecycle.service.js";
import {
  encryptCredential,
  decryptCredential,
} from "../utils/credentialEncryption.js";

export const DEPLOYMENT_INTEGRATION_LIMITS = {
  [PLANS.FREE]: 2,
  [PLANS.PRO]: 10,
  [PLANS.UNLIMITED]: 50,
};

export const ROTATION_GRACE_PERIOD_MS = 15 * 60 * 1000; // 15 minutes

export const hashDeploymentSecret = (secret) => {
  if (typeof secret !== "string" || !secret.trim()) {
    throw new Error("Secret string is required for hashing");
  }
  return createHash("sha256").update(secret.trim()).digest("hex");
};

export const compareSecretHashes = (hashA, hashB) => {
  if (typeof hashA !== "string" || typeof hashB !== "string") return false;
  const bufA = Buffer.from(hashA, "hex");
  const bufB = Buffer.from(hashB, "hex");
  if (bufA.length !== bufB.length) return false;
  try {
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
};

export const generateDeploymentSecret = () => {
  const identifier = randomBytes(6).toString("hex");
  const prefix = `dep_live_${identifier}`;
  const secretPart = randomBytes(32).toString("base64url");
  const secret = `${prefix}_${secretPart}`;
  const secretHash = hashDeploymentSecret(secret);

  let encryptedSecret = null;
  if (env.ALERT_CREDENTIAL_ENCRYPTION_KEY) {
    try {
      encryptedSecret = encryptCredential(secret);
    } catch {
      encryptedSecret = null;
    }
  }

  return { secret, prefix, secretHash, encryptedSecret };
};

const getUserId = (user) => (user.id || user._id)?.toString();

const assertEligibleForIntegration = (user) => {
  if (user.role === ROLES.ADMIN) {
    throw ApiError.forbidden(
      "Deployment integrations are unavailable for administrative accounts.",
      "ROLE_FORBIDDEN",
    );
  }
};

export const listDeploymentIntegrations = async (user) => {
  const owner = getUserId(user);
  return DeploymentIntegration.find({ owner })
    .select(
      "name description prefix environment monitors isActive lastUsedAt revokedAt secretRotatedAt createdAt updatedAt",
    )
    .sort({ createdAt: -1 })
    .lean();
};

export const createDeploymentIntegration = async (user, input) => {
  assertEligibleForIntegration(user);
  const owner = getUserId(user);

  const planDef = getPlanDefinition(user.plan);
  const limit =
    planDef?.limits?.maxDeploymentIntegrations !== undefined
      ? planDef.limits.maxDeploymentIntegrations
      : (DEPLOYMENT_INTEGRATION_LIMITS[user.plan] ?? 2);

  if (limit !== null) {
    const activeCount = await DeploymentIntegration.countDocuments({
      owner,
      revokedAt: null,
    });

    if (activeCount >= limit) {
      if (user.plan === PLANS.FREE) {
        throw ApiError.upgradeRequired(
          `Your Free plan allows up to ${limit} active deployment integrations. Upgrade to Pro for more.`,
          PLANS.PRO,
        );
      }
      if (user.plan === PLANS.PRO) {
        throw ApiError.upgradeRequired(
          `Your Pro plan allows up to ${limit} active deployment integrations. Upgrade to Enterprise for more.`,
          PLANS.UNLIMITED,
        );
      }
      throw ApiError.badRequest(
        `Your plan allows up to ${limit} active deployment integrations. Revoke an existing integration before creating another.`,
      );
    }
  }

  // If specific monitors are supplied, ensure they exist and belong to the user
  const monitorIds = input.monitors || [];
  if (monitorIds.length > 0) {
    const ownedMonitors = await Monitor.find({
      _id: { $in: monitorIds },
      owner,
    }).select("_id");
    if (ownedMonitors.length !== monitorIds.length) {
      throw ApiError.badRequest(
        "One or more configured monitors do not exist or do not belong to you.",
      );
    }
  }

  const { secret, prefix, secretHash, encryptedSecret } =
    generateDeploymentSecret();

  const integration = await DeploymentIntegration.create({
    owner,
    name: input.name,
    description: input.description || null,
    environment: input.environment
      ? input.environment.trim().toLowerCase()
      : null,
    monitors: monitorIds,
    prefix,
    secretHash,
    encryptedSecret,
  });

  return {
    integration: integration.toJSON(),
    secret,
  };
};

export const rotateDeploymentSecret = async (
  user,
  id,
  { immediateRevoke = false } = {},
) => {
  const owner = getUserId(user);
  const integration = await DeploymentIntegration.findOne({
    _id: id,
    owner,
    revokedAt: null,
  }).select("+secretHash +encryptedSecret");

  if (!integration) {
    throw ApiError.notFound("Active deployment integration not found");
  }

  const { secret, prefix, secretHash, encryptedSecret } =
    generateDeploymentSecret();

  integration.previousSecretHash = immediateRevoke
    ? null
    : integration.secretHash;
  integration.previousPrefix = immediateRevoke ? null : integration.prefix;
  integration.secretRotatedAt = new Date();
  integration.prefix = prefix;
  integration.secretHash = secretHash;
  integration.encryptedSecret = encryptedSecret;

  await integration.save();

  return {
    integration: integration.toJSON(),
    secret,
    previousSecretRevoked: Boolean(immediateRevoke),
    message: immediateRevoke
      ? "Deployment secret rotated and previous secret revoked immediately."
      : "Deployment secret rotated successfully. Update your CI/CD pipelines within 15 minutes.",
  };
};

export const revokeDeploymentIntegration = async (user, id) => {
  const owner = getUserId(user);
  const integration = await DeploymentIntegration.findOneAndUpdate(
    { _id: id, owner, revokedAt: null },
    {
      $set: {
        revokedAt: new Date(),
        previousSecretHash: null,
        previousPrefix: null,
        isActive: false,
      },
    },
    { returnDocument: "after" },
  );

  if (!integration) {
    throw ApiError.notFound("Active deployment integration not found");
  }

  return integration.toJSON();
};

export const deleteDeploymentIntegration = async (user, id) => {
  const owner = getUserId(user);
  const result = await DeploymentIntegration.deleteOne({
    _id: id,
    owner,
  });

  if (!result.deletedCount) {
    throw ApiError.notFound("Deployment integration not found");
  }
};

export const authenticateDeploymentSecret = async (token) => {
  if (typeof token !== "string" || !token.trim()) return null;

  const match = /^dep_live_([a-f0-9]{12})_([A-Za-z0-9_-]{32,64})$/.exec(
    token.trim(),
  );
  if (!match) return null;

  const prefix = `dep_live_${match[1]}`;
  const candidateHash = hashDeploymentSecret(token);

  // Look for integration matching current prefix or previous prefix
  const integration = await DeploymentIntegration.findOne({
    $or: [{ prefix }, { previousPrefix: prefix }],
  }).select("+secretHash +previousSecretHash +encryptedSecret");

  if (!integration) return null;
  if (integration.revokedAt || !integration.isActive) {
    return { error: "REVOKED", integration };
  }

  const matchesCurrent = compareSecretHashes(
    candidateHash,
    integration.secretHash,
  );

  let matchesPrevious = false;
  if (
    !matchesCurrent &&
    integration.previousSecretHash &&
    integration.secretRotatedAt
  ) {
    const elapsed =
      Date.now() - new Date(integration.secretRotatedAt).getTime();
    if (elapsed <= ROTATION_GRACE_PERIOD_MS) {
      matchesPrevious = compareSecretHashes(
        candidateHash,
        integration.previousSecretHash,
      );
    }
  }

  if (!matchesCurrent && !matchesPrevious) return null;

  let user = await User.findOne({
    _id: integration.owner,
    active: true,
  }).select("role plan active planStatus planRenewsAt planCanceledAt");
  if (user) user = await expireSubscriptionIfDue(user);
  if (!user || user.role === ROLES.ADMIN) return null;

  return { integration, user };
};

export const authenticateDeploymentSignature = async ({
  keyIdentifier,
  signature,
  rawBody,
}) => {
  if (!keyIdentifier || !signature) return null;

  const prefixMatch = /^dep_live_[a-f0-9]{12}/.exec(keyIdentifier);
  const prefix = prefixMatch ? prefixMatch[0] : keyIdentifier;

  const filter = mongoose.Types.ObjectId.isValid(keyIdentifier)
    ? { _id: keyIdentifier }
    : { $or: [{ prefix }, { previousPrefix: prefix }] };

  const integration = await DeploymentIntegration.findOne(filter).select(
    "+secretHash +encryptedSecret",
  );

  if (!integration) return null;
  if (integration.revokedAt || !integration.isActive) {
    return { error: "REVOKED", integration };
  }

  if (!integration.encryptedSecret) return null;

  let plainSecret;
  try {
    plainSecret = decryptCredential(integration.encryptedSecret);
  } catch {
    return null;
  }

  const cleanSig = signature.startsWith("sha256=")
    ? signature.slice(7).trim()
    : signature.trim();

  if (!/^[a-f0-9]{64}$/i.test(cleanSig)) {
    return null;
  }

  const expected = createHmac("sha256", plainSecret)
    .update(rawBody || "")
    .digest("hex");

  const actualBuf = Buffer.from(cleanSig, "hex");
  const expectedBuf = Buffer.from(expected, "hex");

  if (
    actualBuf.length === 0 ||
    actualBuf.length !== expectedBuf.length ||
    !timingSafeEqual(actualBuf, expectedBuf)
  ) {
    return null;
  }

  let user = await User.findOne({
    _id: integration.owner,
    active: true,
  }).select("role plan active planStatus planRenewsAt planCanceledAt");
  if (user) user = await expireSubscriptionIfDue(user);
  if (!user || user.role === ROLES.ADMIN) return null;

  return { integration, user };
};

export const recordDeploymentIntegrationUse = (integrationId) =>
  DeploymentIntegration.updateOne(
    { _id: integrationId, revokedAt: null },
    { $set: { lastUsedAt: new Date() } },
  ).catch(() => {});

export const recordDeploymentEvent = async ({ integration, payload }) => {
  // CRITICAL SECURITY REQUIREMENT: Never trust owner supplied in body
  const ownerId = integration.owner.toString();

  // 1. Normalize and validate monitor references
  const rawList = [
    ...(payload.monitors || []),
    ...(payload.monitorIds || []),
    ...(payload.monitorId ? [payload.monitorId] : []),
  ];

  const uniqueMonitorIds = [...new Set(rawList.map(String))];

  if (uniqueMonitorIds.length === 0) {
    throw ApiError.badRequest("At least one valid monitor ID is required");
  }

  for (const id of uniqueMonitorIds) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest(`Invalid monitor ID format: ${id}`);
    }
  }

  // 2. Fetch monitors to check existence and ownership
  const monitors = await Monitor.find({
    _id: { $in: uniqueMonitorIds },
  }).select("_id owner name");

  if (monitors.length !== uniqueMonitorIds.length) {
    throw ApiError.notFound("One or more referenced monitors do not exist");
  }

  // 3. Confirm every referenced monitor belongs to the integration owner
  for (const monitor of monitors) {
    if (monitor.owner.toString() !== ownerId) {
      throw ApiError.forbidden(
        "Referenced monitor does not belong to the deployment integration owner",
        "CROSS_ACCOUNT_MONITOR",
      );
    }
  }

  // If the integration is scoped to specific monitors, enforce that constraint
  if (integration.monitors && integration.monitors.length > 0) {
    const allowed = new Set(integration.monitors.map((m) => m.toString()));
    const unauthorized = uniqueMonitorIds.some((id) => !allowed.has(id));
    if (unauthorized) {
      throw ApiError.forbidden(
        "One or more referenced monitors are not permitted for this deployment integration",
        "MONITOR_NOT_ALLOWED_FOR_INTEGRATION",
      );
    }
  }

  // 4. Normalize deployment event fields
  const version =
    payload.version ||
    payload.releaseVersion ||
    payload.release ||
    payload.releaseName;

  if (!version || typeof version !== "string" || !version.trim()) {
    throw ApiError.badRequest("Release version or name is required");
  }

  const commitSha =
    payload.commitSha || payload.commit
      ? String(payload.commitSha || payload.commit).trim()
      : null;

  const environment = (
    payload.environment ||
    integration.environment ||
    "production"
  )
    .trim()
    .toLowerCase();

  const source = payload.source ? String(payload.source).trim() : "custom";
  const url = payload.url || payload.deploymentUrl || null;
  const description = payload.description
    ? String(payload.description).trim()
    : null;

  const externalId = payload.externalId || payload.deploymentId || null;
  const idempotencyKey =
    payload.idempotencyKey ||
    payload.externalId ||
    payload.deploymentId ||
    null;

  const deployedAt = payload.deployedAt
    ? new Date(payload.deployedAt)
    : new Date();
  const receivedAt = new Date();

  // 5. Idempotency Pre-Check
  if (externalId || idempotencyKey) {
    const orConditions = [];
    if (externalId) orConditions.push({ externalId });
    if (idempotencyKey) orConditions.push({ idempotencyKey });

    const existingEvent = await DeploymentEvent.findOne({
      owner: ownerId,
      $or: orConditions,
    });

    if (existingEvent) {
      return { event: existingEvent.toJSON(), isDuplicate: true };
    }
  }

  // 6. Safe Insert with duplicate-event catch for concurrent requests
  try {
    const event = await DeploymentEvent.create({
      owner: ownerId,
      monitors: uniqueMonitorIds,
      version: version.trim(),
      commitSha,
      environment,
      deployedAt,
      receivedAt,
      source,
      url,
      description,
      externalId: externalId ? String(externalId).trim() : null,
      idempotencyKey: idempotencyKey ? String(idempotencyKey).trim() : null,
      integration: integration._id,
      metadata: payload.metadata || undefined,
    });

    return { event: event.toJSON(), isDuplicate: false };
  } catch (err) {
    if (err.code === 11000) {
      const orConditions = [];
      if (externalId)
        orConditions.push({ externalId: String(externalId).trim() });
      if (idempotencyKey)
        orConditions.push({ idempotencyKey: String(idempotencyKey).trim() });

      if (orConditions.length > 0) {
        const existingEvent = await DeploymentEvent.findOne({
          owner: ownerId,
          $or: orConditions,
        });
        if (existingEvent) {
          return { event: existingEvent.toJSON(), isDuplicate: true };
        }
      }
    }
    throw err;
  }
};

export const listDeploymentEvents = async (user, query = {}) => {
  const owner = getUserId(user);
  const filter = { owner };

  if (query.monitorId) {
    filter.monitors = query.monitorId;
  }
  if (query.environment) {
    filter.environment = query.environment.trim().toLowerCase();
  }
  if (query.source) {
    filter.source = query.source.trim();
  }
  if (query.startDate || query.endDate) {
    filter.deployedAt = {};
    if (query.startDate) filter.deployedAt.$gte = new Date(query.startDate);
    if (query.endDate) filter.deployedAt.$lte = new Date(query.endDate);
  }

  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    DeploymentEvent.find(filter)
      .populate("monitors", "name url kind")
      .sort({ deployedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    DeploymentEvent.countDocuments(filter),
  ]);

  return {
    data: data.map((d) => ({
      ...d,
      id: d._id,
      affectedMonitors: d.monitors,
    })),
    total,
    page,
    limit,
  };
};

export const getDeploymentEvent = async (user, id) => {
  const owner = getUserId(user);
  const event = await DeploymentEvent.findOne({ _id: id, owner })
    .populate("monitors", "name url kind")
    .lean();

  if (!event) {
    throw ApiError.notFound("Deployment event not found");
  }

  return {
    ...event,
    id: event._id,
    affectedMonitors: event.monitors,
  };
};

/**
 * List deployment events scoped to a specific monitor and owner.
 * Supports window presets ("24h", "7d", "30d"), environment filtering,
 * pagination, and chronological sorting.
 * Exposes only safe fields; credentials, internal secrets and raw metadata are excluded.
 */
export const getDeploymentsForMonitor = async (
  monitorId,
  user,
  options = {},
) => {
  const userId = getUserId(user);

  // 1. Confirm monitor exists and belongs to the caller
  const monitor = await Monitor.findOne({
    _id: monitorId,
    owner: userId,
  }).lean();
  if (!monitor) {
    throw ApiError.notFound("Monitor not found");
  }

  // 2. Build filter strictly scoped to caller's monitor
  const filter = {
    owner: userId,
    monitors: monitor._id,
  };

  // Support window presets
  if (options.window && WINDOW_MS[options.window]) {
    const since = new Date(Date.now() - WINDOW_MS[options.window]);
    filter.deployedAt = { $gte: since };
  } else if (options.startDate || options.endDate) {
    filter.deployedAt = {};
    if (options.startDate) filter.deployedAt.$gte = new Date(options.startDate);
    if (options.endDate) filter.deployedAt.$lte = new Date(options.endDate);
  }

  // Environment filter
  if (
    options.environment &&
    options.environment.trim() &&
    options.environment.trim().toLowerCase() !== "all"
  ) {
    filter.environment = options.environment.trim().toLowerCase();
  }

  // Pagination
  const page = Math.max(1, parseInt(options.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(options.limit, 10) || 50));
  const skip = (page - 1) * limit;

  // Sorting
  const sortField =
    options.sortBy === "createdAt" || options.sortBy === "version"
      ? options.sortBy
      : "deployedAt";
  const sortDirection = options.order === "asc" ? 1 : -1;
  const sort = { [sortField]: sortDirection };

  // 3. Query with safe projection - strictly excluding internal secrets / raw metadata
  const [items, total] = await Promise.all([
    DeploymentEvent.find(filter)
      .select(
        "version commitSha environment deployedAt receivedAt source url description externalId monitors createdAt updatedAt",
      )
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    DeploymentEvent.countDocuments(filter),
  ]);

  const deploymentIds = items.map((doc) => doc._id);
  let alertStates = [];
  try {
    if (mongoose.connection.readyState === 1) {
      alertStates = await DeploymentAlertState.find({
        monitor: monitor._id,
        deployment: { $in: deploymentIds },
      })
        .select("deployment status regressionType evidence alertDispatchedAt")
        .lean();
    }
  } catch {
    alertStates = [];
  }

  const alertMap = new Map();
  for (const s of alertStates) {
    if (s.deployment) {
      alertMap.set(s.deployment.toString(), s);
    }
  }

  const deployments = items.map((doc) => {
    const alert = alertMap.get((doc._id || doc.id)?.toString());
    return {
      id: doc._id?.toString() || doc.id,
      version: doc.version,
      commitSha: doc.commitSha || null,
      environment: doc.environment,
      deployedAt: doc.deployedAt,
      receivedAt: doc.receivedAt,
      source: doc.source,
      url: doc.url || null,
      description: doc.description || null,
      externalId: doc.externalId || null,
      monitors: doc.monitors,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      regressionStatus: alert?.status || null,
      regressionType: alert?.regressionType || null,
      hasRegression: alert?.status === "suspected_regression",
    };
  });

  return {
    deployments,
    total,
    page,
    limit,
  };
};

/**
 * Get a single deployment event scoped to a specific monitor and owner.
 * Validates ownership and association with the monitor.
 */
export const getDeploymentByIdForMonitor = async (
  monitorId,
  deploymentId,
  user,
) => {
  const userId = getUserId(user);

  // 1. Confirm monitor exists and belongs to caller
  const monitor = await Monitor.findOne({
    _id: monitorId,
    owner: userId,
  }).lean();
  if (!monitor) {
    throw ApiError.notFound("Monitor not found");
  }

  // 2. Find deployment event scoped to owner and monitor
  const doc = await DeploymentEvent.findOne({
    _id: deploymentId,
    owner: userId,
    monitors: monitor._id,
  })
    .select(
      "version commitSha environment deployedAt receivedAt source url description externalId monitors createdAt updatedAt",
    )
    .lean();

  if (!doc) {
    throw ApiError.notFound("Deployment event not found");
  }

  let alertState = null;
  try {
    if (mongoose.connection.readyState === 1) {
      alertState = await DeploymentAlertState.findOne({
        monitor: monitor._id,
        deployment: doc._id,
      }).lean();
    }
  } catch {
    alertState = null;
  }

  return {
    id: doc._id?.toString() || doc.id,
    version: doc.version,
    commitSha: doc.commitSha || null,
    environment: doc.environment,
    deployedAt: doc.deployedAt,
    receivedAt: doc.receivedAt,
    source: doc.source,
    url: doc.url || null,
    description: doc.description || null,
    externalId: doc.externalId || null,
    monitors: doc.monitors,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    regressionStatus: alertState?.status || null,
    regressionType: alertState?.regressionType || null,
    hasRegression: alertState?.status === "suspected_regression",
    regressionState: alertState || null,
  };
};

/**
 * Resolves window duration in minutes from query options.
 */
const resolveWindowMinutes = (options = {}) => {
  if (options.window) {
    const trimmed = String(options.window).trim().toLowerCase();
    if (trimmed === "15m") return 15;
    if (trimmed === "30m") return 30;
    if (trimmed === "1h") return 60;
    if (trimmed === "2h") return 120;
    if (trimmed === "6h") return 360;
    if (trimmed === "24h" || trimmed === "1d") return 1440;
  }
  const mins = parseInt(options.windowMinutes, 10);
  return Number.isInteger(mins) && mins >= 5 && mins <= 1440 ? mins : 30;
};

/**
 * Calculate statistical aggregates (sample count, availability, failure rate, median, p95)
 * for a list of scheduled health checks.
 */
export const calculateCheckStats = (checks = []) => {
  const total = checks.length;
  if (total === 0) {
    return {
      sampleCount: 0,
      successfulChecks: 0,
      failedChecks: 0,
      degradedChecks: 0,
      availability: null,
      failureRate: null,
      medianResponseTime: null,
      p95ResponseTime: null,
      hasSufficientSamples: false,
    };
  }

  let successfulChecks = 0;
  let failedChecks = 0;
  let degradedChecks = 0;
  const validResponseTimes = [];

  for (const c of checks) {
    if (c.status === HEALTH_STATUS.UP) {
      successfulChecks++;
    } else if (c.status === HEALTH_STATUS.DOWN) {
      failedChecks++;
    } else if (c.status === HEALTH_STATUS.DEGRADED) {
      degradedChecks++;
    } else {
      failedChecks++;
    }

    if (
      c.responseTime != null &&
      Number.isFinite(c.responseTime) &&
      c.responseTime >= 0
    ) {
      validResponseTimes.push(c.responseTime);
    }
  }

  validResponseTimes.sort((a, b) => a - b);
  const n = validResponseTimes.length;

  let median = null;
  if (n > 0) {
    if (n === 1) {
      median = validResponseTimes[0];
    } else if (n % 2 === 1) {
      median = validResponseTimes[Math.floor(n / 2)];
    } else {
      median = (validResponseTimes[n / 2 - 1] + validResponseTimes[n / 2]) / 2;
    }
    median = Math.round(median * 100) / 100;
  }

  let p95 = null;
  if (n >= 5) {
    const idx = Math.ceil(0.95 * n) - 1;
    p95 = Math.round(validResponseTimes[Math.max(0, idx)] * 100) / 100;
  } else if (n > 0) {
    p95 = Math.round(validResponseTimes[n - 1] * 100) / 100;
  }

  const availability = Math.round((successfulChecks / total) * 10000) / 100;
  const failureRate = Math.round((failedChecks / total) * 10000) / 100;

  return {
    sampleCount: total,
    successfulChecks,
    failedChecks,
    degradedChecks,
    availability,
    failureRate,
    medianResponseTime: median,
    p95ResponseTime: p95,
    hasSufficientSamples: total >= 3,
  };
};

/**
 * Calculates differences and percentage shifts between before and after metric sets.
 */
export const calculateMetricDiffs = (before, after) => {
  const diff = {
    availabilityChange: null,
    failureRateChange: null,
    medianResponseTimeChangeMs: null,
    medianResponseTimeChangePercent: null,
    p95ResponseTimeChangeMs: null,
    p95ResponseTimeChangePercent: null,
  };

  if (before.availability != null && after.availability != null) {
    diff.availabilityChange =
      Math.round((after.availability - before.availability) * 100) / 100;
  }

  if (before.failureRate != null && after.failureRate != null) {
    diff.failureRateChange =
      Math.round((after.failureRate - before.failureRate) * 100) / 100;
  }

  if (before.medianResponseTime != null && after.medianResponseTime != null) {
    diff.medianResponseTimeChangeMs =
      Math.round((after.medianResponseTime - before.medianResponseTime) * 100) /
      100;
    if (before.medianResponseTime > 0) {
      diff.medianResponseTimeChangePercent =
        Math.round(
          ((after.medianResponseTime - before.medianResponseTime) /
            before.medianResponseTime) *
            10000,
        ) / 100;
    }
  }

  if (before.p95ResponseTime != null && after.p95ResponseTime != null) {
    diff.p95ResponseTimeChangeMs =
      Math.round((after.p95ResponseTime - before.p95ResponseTime) * 100) / 100;
    if (before.p95ResponseTime > 0) {
      diff.p95ResponseTimeChangePercent =
        Math.round(
          ((after.p95ResponseTime - before.p95ResponseTime) /
            before.p95ResponseTime) *
            10000,
        ) / 100;
    }
  }

  return diff;
};

/**
 * Evaluates objective empirical evidence for possible regressions.
 * Reports temporal association without speculative root-cause claims.
 */
export const evaluateRegressionEvidence = ({
  before,
  after,
  diff,
  relatedIncidents = [],
  isWindowIncomplete = false,
}) => {
  const evidence = [];
  let isSuspectedRegression = false;

  // 1. Incidents started after deployment
  const postDeployIncidents = relatedIncidents.filter(
    (inc) => inc.timingRelation === "started_after_deployment",
  );
  if (postDeployIncidents.length > 0) {
    isSuspectedRegression = true;
    evidence.push(
      `${postDeployIncidents.length} incident${
        postDeployIncidents.length > 1 ? "s" : ""
      } began after deployment.`,
    );
  }

  // 2. Failure rate increase
  if (diff.failureRateChange != null && diff.failureRateChange >= 5.0) {
    isSuspectedRegression = true;
    evidence.push(
      `Failure rate increased by +${diff.failureRateChange}% (from ${before.failureRate}% to ${after.failureRate}%, ${after.failedChecks} failed checks).`,
    );
  } else if (
    before.availability != null &&
    after.availability != null &&
    diff.availabilityChange != null &&
    diff.availabilityChange <= -5.0
  ) {
    isSuspectedRegression = true;
    evidence.push(
      `Availability dropped by ${diff.availabilityChange}% (from ${before.availability}% to ${after.availability}%).`,
    );
  }

  // 3. Response time regression
  if (
    diff.medianResponseTimeChangePercent != null &&
    diff.medianResponseTimeChangePercent >= 20.0 &&
    diff.medianResponseTimeChangeMs >= 30.0 &&
    before.hasSufficientSamples &&
    after.hasSufficientSamples
  ) {
    isSuspectedRegression = true;
    evidence.push(
      `Median response time degraded by +${diff.medianResponseTimeChangeMs} ms (+${diff.medianResponseTimeChangePercent}%) from ${before.medianResponseTime} ms to ${after.medianResponseTime} ms.`,
    );
  } else if (
    diff.p95ResponseTimeChangePercent != null &&
    diff.p95ResponseTimeChangePercent >= 25.0 &&
    diff.p95ResponseTimeChangeMs >= 50.0 &&
    before.hasSufficientSamples &&
    after.hasSufficientSamples
  ) {
    isSuspectedRegression = true;
    evidence.push(
      `P95 latency degraded by +${diff.p95ResponseTimeChangeMs} ms (+${diff.p95ResponseTimeChangePercent}%) from ${before.p95ResponseTime} ms to ${after.p95ResponseTime} ms.`,
    );
  }

  // 4. Data sufficiency
  if (!before.hasSufficientSamples || !after.hasSufficientSamples) {
    if (evidence.length === 0) {
      evidence.push(
        `Insufficient sample history (${before.sampleCount} before / ${after.sampleCount} after) to establish a statistically confident comparison.`,
      );
      return {
        status: "insufficient_data",
        evidence,
      };
    }
  }

  if (isSuspectedRegression) {
    return {
      status: "suspected_regression",
      evidence,
    };
  }

  if (before.sampleCount > 0 && after.sampleCount > 0) {
    evidence.push(
      "Response times and failure rates remained stable within expected operational variance.",
    );
  }

  return {
    status: "normal",
    evidence,
  };
};

/**
 * Performance impact analysis comparing health before and after a specific deployment.
 */
export const getDeploymentImpact = async (
  monitorId,
  deploymentId,
  user,
  options = {},
) => {
  const userId = getUserId(user);

  // 1. Confirm monitor exists and is owned by caller
  const monitor = await Monitor.findOne({
    _id: monitorId,
    owner: userId,
  }).lean();
  if (!monitor) {
    throw ApiError.notFound("Monitor not found");
  }

  // 2. Confirm deployment exists, is owned by caller, and affected monitor
  const deployment = await DeploymentEvent.findOne({
    _id: deploymentId,
    owner: userId,
    monitors: monitor._id,
  }).lean();
  if (!deployment) {
    throw ApiError.notFound("Deployment event not found");
  }

  // 3. Resolve comparison interval
  const windowMinutes = resolveWindowMinutes(options);
  const windowMs = windowMinutes * 60 * 1000;
  const deployedTime = new Date(deployment.deployedAt).getTime();

  const beforeStart = new Date(deployedTime - windowMs);
  const beforeEnd = new Date(deployedTime);
  const afterStart = new Date(deployedTime);
  const afterEnd = new Date(deployedTime + windowMs);

  const nowTime = Date.now();
  const effectiveAfterEnd = new Date(Math.min(afterEnd.getTime(), nowTime));
  const isWindowIncomplete = nowTime < afterEnd.getTime();
  const elapsedAfterMinutes = Math.max(
    1,
    Math.round((effectiveAfterEnd.getTime() - afterStart.getTime()) / 60000),
  );

  // 4. Fetch scheduled health checks for before and after windows
  const [beforeChecks, afterChecks] = await Promise.all([
    HealthCheck.find({
      monitor: monitor._id,
      checkedAt: { $gte: beforeStart, $lt: beforeEnd },
      scheduled: true,
    })
      .select("status responseTime checkedAt")
      .sort({ checkedAt: 1 })
      .lean(),
    HealthCheck.find({
      monitor: monitor._id,
      checkedAt: { $gte: afterStart, $lte: effectiveAfterEnd },
      scheduled: true,
    })
      .select("status responseTime checkedAt")
      .sort({ checkedAt: 1 })
      .lean(),
  ]);

  // 5. Query overlapping incidents for this monitor (excluding job monitors)
  const rawIncidents = await Incident.find({
    monitor: monitor._id,
    startedAt: { $lte: afterEnd },
    $or: [{ endedAt: null }, { endedAt: { $gte: beforeStart } }],
  })
    .select("title message status severity startedAt endedAt duration")
    .sort({ startedAt: 1 })
    .lean();

  const relatedIncidents = rawIncidents.map((inc) => {
    const incStart = new Date(inc.startedAt).getTime();
    const incEnd = inc.endedAt ? new Date(inc.endedAt).getTime() : null;

    let timingRelation = "ongoing_during_deployment";
    if (incStart >= deployedTime) {
      timingRelation = "started_after_deployment";
    } else if (incEnd !== null && incEnd <= deployedTime) {
      timingRelation = "resolved_before_deployment";
    }

    const duration =
      inc.duration != null
        ? inc.duration
        : incEnd
          ? Math.round((incEnd - incStart) / 1000)
          : Math.round((nowTime - incStart) / 1000);

    const timeDeltaSeconds = Math.round((incStart - deployedTime) / 1000);

    return {
      id: inc._id.toString(),
      title: inc.title || inc.message || "Monitor Incident",
      status: inc.status,
      severity: inc.severity || "minor",
      startedAt: inc.startedAt,
      endedAt: inc.endedAt || null,
      duration,
      timingRelation,
      timeDeltaSeconds,
    };
  });

  // 6. Aggregate metrics and diffs
  const beforeStats = calculateCheckStats(beforeChecks);
  const afterStats = calculateCheckStats(afterChecks);
  const diff = calculateMetricDiffs(beforeStats, afterStats);

  // 7. Regression evaluation
  const correlation = evaluateRegressionEvidence({
    before: beforeStats,
    after: afterStats,
    diff,
    relatedIncidents,
    isWindowIncomplete,
  });

  let alertState = null;
  try {
    if (mongoose.connection.readyState === 1) {
      alertState = await DeploymentAlertState.findOne({
        monitor: monitor._id,
        deployment: deployment._id,
      }).lean();
    }
  } catch {
    alertState = null;
  }

  return {
    deployment: {
      id: deployment._id?.toString() || deployment.id,
      version: deployment.version,
      commitSha: deployment.commitSha || null,
      environment: deployment.environment,
      deployedAt: deployment.deployedAt,
      source: deployment.source,
      url: deployment.url || null,
    },
    monitor: {
      id: monitor._id?.toString() || monitor.id,
      name: monitor.name,
      url: monitor.url,
    },
    window: {
      windowMinutes,
      beforeStart,
      beforeEnd,
      afterStart,
      afterEnd,
      effectiveAfterEnd,
      isWindowIncomplete,
      elapsedAfterMinutes,
    },
    metrics: {
      before: beforeStats,
      after: afterStats,
      diff,
    },
    correlation,
    relatedIncidents,
    alertState: alertState || null,
  };
};

/**
 * Find deployments associated with a monitor that occurred temporally near an incident.
 * Centralizes the correlation logic so incident details can expose relevant releases.
 */
export const findDeploymentsNearIncident = async (
  incident,
  user,
  windowMinutes = 120,
) => {
  if (!incident || !incident.monitor) return [];

  const monitorId = incident.monitor._id || incident.monitor;
  const userId = getUserId(user);
  const incStartTime = new Date(incident.startedAt).getTime();
  if (isNaN(incStartTime)) return [];

  const lookbackMs = windowMinutes * 60 * 1000;
  const lookforwardMs = 30 * 60 * 1000; // 30 minutes after incident started
  const rangeStart = new Date(incStartTime - lookbackMs);
  const rangeEnd = new Date(incStartTime + lookforwardMs);

  const deployments = await DeploymentEvent.find({
    owner: userId,
    monitors: monitorId,
    deployedAt: { $gte: rangeStart, $lte: rangeEnd },
  })
    .select("version commitSha environment deployedAt source url description")
    .sort({ deployedAt: -1 })
    .limit(10)
    .lean();

  return deployments.map((d) => {
    const depTime = new Date(d.deployedAt).getTime();
    const timeDeltaSeconds = Math.round((incStartTime - depTime) / 1000);
    const temporalRelation =
      depTime <= incStartTime
        ? "deployed_before_incident"
        : "deployed_after_incident";

    return {
      id: d._id?.toString() || d.id,
      version: d.version,
      commitSha: d.commitSha || null,
      environment: d.environment,
      deployedAt: d.deployedAt,
      source: d.source,
      url: d.url || null,
      description: d.description || null,
      timeDeltaSeconds,
      temporalRelation,
    };
  });
};
