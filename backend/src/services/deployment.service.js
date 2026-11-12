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
import User from "../models/User.js";
import ApiError from "../utils/ApiError.js";
import env from "../config/env.js";
import { PLANS, ROLES, WINDOW_MS } from "../config/constants.js";
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

  const deployments = items.map((doc) => ({
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
  }));

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
  };
};
