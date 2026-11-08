import Monitor from "../models/Monitor.js";
import HealthCheck from "../models/HealthCheck.js";
import DailyStat from "../models/DailyStat.js";
import Incident from "../models/Incident.js";
import StatusPage from "../models/StatusPage.js";
import HourlyStat from "../models/HourlyStat.js";
import PerformanceAlertState from "../models/PerformanceAlertState.js";
import RegionalCheck from "../models/RegionalCheck.js";
import RegionalProbeRun from "../models/RegionalProbeRun.js";
import ProbeAgent from "../models/ProbeAgent.js";
import RegionalPerformanceState from "../models/RegionalPerformanceState.js";
import RegionalIncident from "../models/RegionalIncident.js";
import RegionalDailyStat from "../models/RegionalDailyStat.js";
import RegionalHourlyStat from "../models/RegionalHourlyStat.js";
import ApiError from "../utils/ApiError.js";
import { ROLES } from "../config/constants.js";
import { hasFeature, FEATURES } from "../config/features.js";
import { getPlanDefinition } from "../config/plans.js";
import { getRegion } from "../config/regions.js";
import {
  isIntervalAllowedForPlan,
  getMinCheckInterval,
} from "../utils/planUtils.js";
import { logActivity } from "../utils/activityLogger.js";
import { encryptCredential } from "../utils/credentialEncryption.js";
import {
  ACTIVITY_CATEGORIES,
  ACTIVITY_ACTIONS,
} from "../config/activityConstants.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

const resolveOwnerId = (user) => user.id || user._id.toString();

const getApiMonitorLimit = (plan) =>
  getPlanDefinition(plan)?.limits.maxApiMonitors ?? 0;
const toPlainMap = (value) =>
  value instanceof Map ? Object.fromEntries(value) : { ...(value || {}) };
const isSensitiveName = (name) =>
  /(^|[-_])(api[-_]?key|key|access[-_]?token|token|secret|password|credential|auth|authorization)([-_]|$)/i.test(
    name.replace(/([a-z])([A-Z])/g, "$1-$2"),
  );
export const countOwnedApiMonitors = (user, excludeId, model = Monitor) =>
  model.countDocuments({
    owner: resolveOwnerId(user),
    kind: "api",
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  });

export const assertApiMonitorAllowed = async (
  user,
  excludeId,
  countFn = countOwnedApiMonitors,
) => {
  if (!hasFeature(user.plan, FEATURES.API_MONITORING)) {
    throw ApiError.featureRestricted(
      "API contract monitoring isn't available on your current plan.",
    );
  }
  const limit = getApiMonitorLimit(user.plan);
  const used = await countFn(user, excludeId);
  if (limit != null && used >= limit) {
    throw ApiError.upgradeRequired(
      `Your plan allows up to ${limit} API monitors. Upgrade to add more.`,
    );
  }
};

export const secureApiConfig = (config, existing = null) => {
  const result = { ...config };
  if (config.body === undefined && existing?.encryptedBody) {
    result.bodyConfigured = Boolean(existing.bodyConfigured);
    result.encryptedBody = existing.encryptedBody;
  } else if (config.body == null || config.body === "") {
    result.bodyConfigured = false;
    result.encryptedBody = null;
  } else {
    try {
      result.bodyConfigured = true;
      result.encryptedBody = encryptCredential(config.body);
    } catch {
      throw ApiError.internal("API request body could not be secured.");
    }
  }
  delete result.body;
  const secureNamedValues = (field, encryptedField, namesField) => {
    const previousEncrypted = toPlainMap(existing?.[encryptedField]);
    if (config[field] === undefined && existing?.[encryptedField]) {
      result[field] = toPlainMap(existing[field]);
      result[encryptedField] = previousEncrypted;
      result[namesField] =
        existing[namesField] || Object.keys(previousEncrypted);
      return;
    }
    const publicValues = {};
    const encryptedValues = {};
    for (const [name, value] of Object.entries(config[field] || {})) {
      if (!isSensitiveName(name)) {
        publicValues[name] = value;
        continue;
      }
      try {
        encryptedValues[name] =
          value === "********" && previousEncrypted[name]
            ? previousEncrypted[name]
            : encryptCredential(value);
      } catch {
        throw ApiError.internal(
          "API configuration values could not be secured.",
        );
      }
    }
    result[field] = publicValues;
    result[encryptedField] = encryptedValues;
    result[namesField] = Object.keys(encryptedValues);
  };
  secureNamedValues("headers", "encryptedHeaders", "secretHeaderNames");
  secureNamedValues(
    "queryParams",
    "encryptedQueryParams",
    "secretQueryParamNames",
  );
  const previousAuth = existing?.authentication || { mode: "none" };
  const requested = config.authentication;
  const auth = requested
    ? { ...requested }
    : { mode: previousAuth.mode || "none" };
  if (auth.mode === "none") {
    result.authentication = {
      mode: "none",
      credentialConfigured: false,
      username: null,
      credentialCiphertext: null,
    };
    return result;
  }
  try {
    if (auth.mode === "bearer") {
      if (
        auth.token !== undefined &&
        (typeof auth.token !== "string" || !auth.token)
      )
        throw new Error("missing");
      const ciphertext = auth.token
        ? encryptCredential(auth.token)
        : previousAuth.mode === "bearer" && previousAuth.credentialCiphertext;
      if (!ciphertext) throw new Error("missing");
      result.authentication = {
        mode: "bearer",
        credentialConfigured: true,
        username: null,
        credentialCiphertext: ciphertext,
      };
      return result;
    }
    if (auth.mode === "basic") {
      if (
        auth.password !== undefined &&
        (typeof auth.password !== "string" || !auth.password)
      )
        throw new Error("missing");
      const username =
        auth.username ??
        (previousAuth.mode === "basic" ? previousAuth.username : null);
      const ciphertext = auth.password
        ? encryptCredential(auth.password)
        : previousAuth.mode === "basic" && previousAuth.credentialCiphertext;
      if (!username || !ciphertext) throw new Error("missing");
      result.authentication = {
        mode: "basic",
        credentialConfigured: true,
        username,
        credentialCiphertext: ciphertext,
      };
      return result;
    }
    throw new Error("unsupported");
  } catch (error) {
    if (error.message === "missing" || error.message === "unsupported") {
      throw ApiError.badRequest(
        "API authentication credentials are incomplete or could not be secured.",
      );
    }
    throw ApiError.internal("API credentials could not be secured.");
  }
};

export const assertRegionalMonitoringAllowed = async (
  user,
  config = {},
  interval = 300,
  excludeMonitorId,
  retainedRegions = [],
) => {
  if (!config?.enabled) return;
  const definition = getPlanDefinition(user.plan);
  const regions = config.regions || [];
  const maxRegions = definition?.limits.maxRegionsPerMonitor ?? 0;
  if (
    !hasFeature(user.plan, FEATURES.REGIONAL_MONITORING) ||
    regions.length > maxRegions
  ) {
    throw ApiError.upgradeRequired(
      `Your plan allows up to ${maxRegions} monitoring region${maxRegions === 1 ? "" : "s"} per monitor.`,
    );
  }
  if (!regions.length)
    throw ApiError.badRequest(
      "Select at least one region for regional monitoring.",
    );
  if (regions.some((id) => !getRegion(id)))
    throw ApiError.badRequest("A selected probe region is not available.");
  const online = await ProbeAgent.distinct("regionId", {
    regionId: { $in: regions },
    lastHeartbeatAt: { $gte: new Date(Date.now() - 90_000) },
  });
  const unavailableNewRegions = regions.filter(
    (region) => !online.includes(region) && !retainedRegions.includes(region),
  );
  if (unavailableNewRegions.length) {
    throw ApiError.badRequest(
      "One or more selected regions do not currently have an active probe agent.",
    );
  }

  const ownerId = resolveOwnerId(user);
  const filter = { owner: ownerId, "regionalMonitoring.enabled": true };
  if (excludeMonitorId) filter._id = { $ne: excludeMonitorId };
  const existing = await Monitor.find(filter)
    .select("interval regionalMonitoring")
    .lean();
  const requested = regions.length * (86_400 / interval);
  const used = existing.reduce(
    (sum, monitor) =>
      sum +
      monitor.regionalMonitoring.regions.length * (86_400 / monitor.interval),
    0,
  );
  const budget = definition?.limits.regionalChecksPerDay;
  if (budget != null && used + requested > budget) {
    throw ApiError.upgradeRequired(
      `Regional monitoring would exceed your account budget of ${budget.toLocaleString()} regional checks per day.`,
    );
  }
};

/**
 * Throws ApiError.upgradeRequired when `interval` is faster than the
 * user's plan permits. Centralizes the check so it's applied identically
 * on create and on update — the Zod schema only validates that the value
 * is one of the fixed presets; the plan-dependent floor can't live there
 * since it varies per user.
 */
export const assertIntervalAllowedForPlan = (plan, interval) => {
  if (!isIntervalAllowedForPlan(plan, interval)) {
    const minSeconds = getMinCheckInterval(plan);
    throw ApiError.upgradeRequired(
      `Your current plan only allows check intervals of ${minSeconds} seconds or slower. Upgrade your plan to enable faster polling.`,
    );
  }
};

/**
 * Resolves every monitor ID owned by a user. This is the scoping
 * primitive shared by dashboard.service.js and incident.service.js to
 * constrain their aggregations to a single user's data — see those files
 * for how it's applied.
 */
export const getOwnedMonitorIds = async (user) => {
  const ownerId = resolveOwnerId(user);
  const docs = await Monitor.find({ owner: ownerId }).select("_id").lean();
  return docs.map((d) => d._id);
};

/**
 * Cheap count-only variant of getOwnedMonitorIds — used as the countFn for
 * middlewares/featureAccess.js#requireWithinLimit so a limit check never
 * has to materialize the full ID list.
 */
export const countOwnedMonitors = async (user) => {
  const ownerId = resolveOwnerId(user);
  return Monitor.countDocuments({ owner: ownerId });
};

// ── Service methods ───────────────────────────────────────────────────────────

export const createMonitor = async (data, user) => {
  // Admin accounts are management-only — they never own monitors. This is
  // primary/architecturally enforced by config/permissions.js (the ADMIN
  // role simply doesn't grant "monitor:create", so
  // requirePermission("monitor:create") in routes/monitor.routes.js
  // already 403s before this function ever runs). This is a second,
  // explicit layer purely for defense-in-depth and a clearer error
  // message, mirroring how middlewares/authenticate.js double-checks
  // suspended accounts even though session destruction already covers it.
  if (user.role === ROLES.ADMIN) {
    throw ApiError.forbidden(
      "Admin accounts cannot create monitors. Monitors are owned by individual user accounts.",
      "ROLE_FORBIDDEN",
    );
  }

  const ownerId = resolveOwnerId(user);
  // This property is retained only for compatibility with the existing
  // website form. API methods live under apiConfig.method.
  delete data.method;

  if ((data.kind || "website") === "api") {
    if (data.url.length > 2048)
      throw ApiError.badRequest("API URL cannot exceed 2048 characters.");
    await assertApiMonitorAllowed(user);
    if (data.regionalMonitoring?.enabled) {
      throw ApiError.badRequest(
        "Regional monitoring is not available for API monitors yet.",
      );
    }
    const parsedUrl = new URL(data.url);
    if (parsedUrl.username || parsedUrl.password)
      throw ApiError.badRequest(
        "API URL must not contain embedded credentials.",
      );
    if (parsedUrl.search || parsedUrl.hash)
      throw ApiError.badRequest(
        "Place API query parameters in apiConfig.queryParams; API URLs cannot contain a query or fragment.",
      );
    data.apiConfig = secureApiConfig(data.apiConfig);
  }

  assertIntervalAllowedForPlan(user.plan, data.interval);
  await assertRegionalMonitoringAllowed(
    user,
    data.regionalMonitoring,
    data.interval,
  );

  const existing = await Monitor.findOne({ owner: ownerId, url: data.url });
  if (existing) {
    throw ApiError.conflict(
      data.kind === "api"
        ? "You already have a monitor for this URL."
        : `You already have a monitor for "${data.url}"`,
    );
  }

  const monitor = await Monitor.create({ ...data, owner: ownerId });

  await logActivity({
    userId: ownerId,
    category: ACTIVITY_CATEGORIES.MONITOR,
    action: ACTIVITY_ACTIONS.MONITOR_CREATED,
    description: `Created monitor "${monitor.name}"`,
    entityType: "Monitor",
    entityId: monitor._id,
    metadata:
      data.kind === "api"
        ? { kind: "api", interval: monitor.interval }
        : { url: monitor.url, interval: monitor.interval },
  });

  return monitor;
};

export const getMonitors = async (
  { page, limit, active, sortBy, order },
  user,
) => {
  const ownerId = resolveOwnerId(user);
  const filter = { owner: ownerId };
  if (active !== undefined) filter.active = active;

  const sort = { [sortBy]: order === "asc" ? 1 : -1 };
  const skip = (page - 1) * limit;

  const [monitors, total] = await Promise.all([
    Monitor.find(filter).sort(sort).skip(skip).limit(limit),
    Monitor.countDocuments(filter),
  ]);

  return {
    monitors,
    total,
    page,
    totalPages: Math.ceil(total / limit) || 1,
  };
};

export const getMonitorById = async (id, user) => {
  const ownerId = resolveOwnerId(user);

  // Combining _id and owner in a single query (rather than fetch-then-check)
  // means a foreign monitor ID resolves to the same 404 as a nonexistent
  // one — no existence leak across accounts.
  const monitor = await Monitor.findOne({ _id: id, owner: ownerId });
  if (!monitor) {
    throw ApiError.notFound(`Monitor not found with id: ${id}`);
  }
  return monitor;
};

const SECURITY_HEADERS = [
  ["strict-transport-security", "Enforces HTTPS connections"],
  ["content-security-policy", "Restricts permitted content sources"],
  ["x-content-type-options", "Prevents MIME type sniffing"],
  ["x-frame-options", "Helps prevent clickjacking"],
  ["referrer-policy", "Controls referrer information"],
  ["permissions-policy", "Restricts browser features"],
];

export const getMonitorDiagnostics = async (id, user) => {
  const monitor = await getMonitorById(id, user);
  const check = await HealthCheck.findOne({ monitor: monitor._id })
    .sort({ checkedAt: -1 })
    .select(
      "status httpStatus responseTime failureReason checkedAt diagnostics",
    )
    .lean();
  const headers = check?.diagnostics?.headers || {};
  const securityHeaders = SECURITY_HEADERS.map(([name, purpose]) => ({
    name,
    purpose,
    value: headers[name] ?? null,
    present: Boolean(headers[name]),
  }));
  return {
    monitor: { id: monitor.id, name: monitor.name, url: monitor.url },
    checkedAt: check?.checkedAt ?? null,
    http: check
      ? {
          status: check.httpStatus,
          statusText: check.diagnostics?.statusText ?? null,
          responseTimeMs: check.responseTime,
          failureReason: check.failureReason,
          finalUrl: check.diagnostics?.finalUrl ?? monitor.url,
          timing: check.diagnostics?.timing ?? { totalMs: check.responseTime },
        }
      : null,
    dns: check?.diagnostics?.dns ?? null,
    headers,
    securityHeaders,
    redirects: check?.diagnostics?.redirects ?? [],
  };
};

export const updateMonitor = async (id, data, user) => {
  const ownerId = resolveOwnerId(user);
  delete data.method;
  const previous = await Monitor.findOne({ _id: id, owner: ownerId })
    .select(
      "active url interval regionalMonitoring kind apiConfig +apiConfig.authentication.credentialCiphertext +apiConfig.authentication.username +apiConfig.encryptedHeaders +apiConfig.encryptedQueryParams +apiConfig.encryptedBody",
    )
    .lean();
  if (!previous) throw ApiError.notFound(`Monitor not found with id: ${id}`);
  const nextKind = data.kind || previous.kind || "website";
  if (nextKind === "api") {
    const parsedUrl = new URL(data.url || previous.url);
    if ((data.url || previous.url).length > 2048)
      throw ApiError.badRequest("API URL cannot exceed 2048 characters.");
    if (parsedUrl.username || parsedUrl.password)
      throw ApiError.badRequest(
        "API URL must not contain embedded credentials.",
      );
    if (parsedUrl.search || parsedUrl.hash)
      throw ApiError.badRequest(
        "Place API query parameters in apiConfig.queryParams; API URLs cannot contain a query or fragment.",
      );
  }
  if (
    nextKind === "api" &&
    (data.kind === "api" ||
      data.apiConfig !== undefined ||
      previous.kind !== "api")
  ) {
    await assertApiMonitorAllowed(user, id);
    if ((data.regionalMonitoring || previous.regionalMonitoring)?.enabled) {
      throw ApiError.badRequest(
        "Regional monitoring is not available for API monitors yet.",
      );
    }
    const nextUrl = data.url || previous.url;
    const parsedUrl = new URL(nextUrl);
    if (parsedUrl.username || parsedUrl.password)
      throw ApiError.badRequest(
        "API URL must not contain embedded credentials.",
      );
    if (parsedUrl.search || parsedUrl.hash)
      throw ApiError.badRequest(
        "Place API query parameters in apiConfig.queryParams; API URLs cannot contain a query or fragment.",
      );
    const nextConfig = data.apiConfig || previous.apiConfig;
    if (!nextConfig)
      throw ApiError.badRequest(
        "API configuration is required for API monitors.",
      );
    data.apiConfig = secureApiConfig(nextConfig, previous.apiConfig);
  }
  if (nextKind === "website" && data.apiConfig)
    throw ApiError.badRequest(
      "API configuration is only valid for API monitors.",
    );

  if (data.performanceAlerts) {
    const configurable = Object.keys(data.performanceAlerts).some(
      (key) => key !== "enabled",
    );
    if (
      configurable &&
      !hasFeature(user.plan, FEATURES.PERFORMANCE_ALERT_CONFIG)
    )
      throw ApiError.upgradeRequired(
        "Configurable performance alert sensitivity is available on Pro and Enterprise.",
      );
  }

  if (data.interval !== undefined) {
    assertIntervalAllowedForPlan(user.plan, data.interval);
  }
  const regionalConfig =
    data.regionalMonitoring || previous?.regionalMonitoring;
  if (
    regionalConfig &&
    (data.regionalMonitoring || data.interval !== undefined)
  ) {
    await assertRegionalMonitoringAllowed(
      user,
      regionalConfig,
      data.interval || previous?.interval || 300,
      id,
      previous?.regionalMonitoring?.regions || [],
    );
  }

  if (data.url) {
    const existing = await Monitor.findOne({
      owner: ownerId,
      url: data.url,
      _id: { $ne: id },
    });
    if (existing) {
      throw ApiError.conflict(
        nextKind === "api"
          ? "You already have a monitor for this URL."
          : `You already have a monitor for "${data.url}"`,
      );
    }
  }

  // Reactivating a monitor schedules an immediate re-check.
  if (data.active === true) {
    data.nextCheckAt = new Date();
  }
  // Re-evaluate cadence promptly after a configured interval changes.
  if (data.interval !== undefined) data.nextCheckAt = new Date();

  const update = { ...data };
  if (nextKind === "website") {
    update.kind = "website";
    update.$unset = { apiConfig: 1 };
    delete update.apiConfig;
  }
  const monitor = await Monitor.findOneAndUpdate(
    { _id: id, owner: ownerId },
    update.$unset
      ? {
          $set: Object.fromEntries(
            Object.entries(update).filter(([key]) => key !== "$unset"),
          ),
          $unset: update.$unset,
        }
      : update,
    { returnDocument: "after", runValidators: true },
  );

  if (!monitor) {
    throw ApiError.notFound(`Monitor not found with id: ${id}`);
  }

  if (data.url !== undefined && previous?.url !== monitor.url) {
    await PerformanceAlertState.updateOne(
      { monitor: monitor._id, metric: "responseTime" },
      {
        $set: {
          status: "normal",
          baselineMedianMs: null,
          baselineMadMs: null,
          baselineUrl: monitor.url,
          baselineStartedAt: new Date(),
          baselineSamples: [],
          recentSamples: [],
          consecutiveBreaches: 0,
          consecutiveRecoveries: 0,
          lastEvaluatedCheckId: null,
          lastAlertAt: null,
          lastNotifiedAt: null,
        },
        $setOnInsert: { monitor: monitor._id, metric: "responseTime" },
      },
      { upsert: true },
    );
    await RegionalPerformanceState.updateMany(
      { monitor: monitor._id },
      {
        $set: {
          status: "normal",
          baselineSamples: [],
          recentSamples: [],
          baselineMedianMs: null,
          baselineMadMs: null,
          consecutiveBreaches: 0,
          consecutiveRecoveries: 0,
          lastEvaluatedCheck: null,
          lastAlertAt: null,
        },
      },
    );
  }

  // Distinguish a pause/resume toggle from a general field edit so the
  // activity timeline reads naturally ("Paused monitor X" vs. "Updated
  // monitor X") rather than always saying "updated".
  const activeChanged =
    previous && data.active !== undefined && previous.active !== data.active;

  await logActivity({
    userId: ownerId,
    category: ACTIVITY_CATEGORIES.MONITOR,
    action: activeChanged
      ? monitor.active
        ? ACTIVITY_ACTIONS.MONITOR_RESUMED
        : ACTIVITY_ACTIONS.MONITOR_PAUSED
      : ACTIVITY_ACTIONS.MONITOR_UPDATED,
    description: activeChanged
      ? `${monitor.active ? "Resumed" : "Paused"} monitor "${monitor.name}"`
      : `Updated monitor "${monitor.name}"`,
    entityType: "Monitor",
    entityId: monitor._id,
    metadata: { changedFields: Object.keys(data) },
  });

  return monitor;
};

export const duplicateMonitor = async (id, data, user) => {
  const source = await getMonitorById(id, user);
  const ownerId = resolveOwnerId(user);
  delete data.method;
  if (data.kind === undefined && source.kind === "api") {
    const sourceConfig = source.apiConfig?.toObject?.() || source.apiConfig;
    data = {
      ...data,
      kind: "api",
      apiConfig: {
        ...sourceConfig,
        queryParams: toPlainMap(sourceConfig?.queryParams),
        headers: toPlainMap(sourceConfig?.headers),
        authentication: { mode: "none" },
      },
    };
  }
  if ((data.kind || source.kind || "website") === "api") {
    if (data.url.length > 2048)
      throw ApiError.badRequest("API URL cannot exceed 2048 characters.");
    await assertApiMonitorAllowed(user);
    if (data.regionalMonitoring?.enabled)
      throw ApiError.badRequest(
        "Regional monitoring is not available for API monitors yet.",
      );
    const parsedUrl = new URL(data.url);
    if (parsedUrl.username || parsedUrl.password)
      throw ApiError.badRequest(
        "API URL must not contain embedded credentials.",
      );
    if (parsedUrl.search || parsedUrl.hash)
      throw ApiError.badRequest(
        "Place API query parameters in apiConfig.queryParams; API URLs cannot contain a query or fragment.",
      );
    data.apiConfig = secureApiConfig(data.apiConfig);
  }
  assertIntervalAllowedForPlan(user.plan, data.interval);
  await assertRegionalMonitoringAllowed(
    user,
    data.regionalMonitoring,
    data.interval,
  );
  const existing = await Monitor.findOne({ owner: ownerId, url: data.url });
  if (existing)
    throw ApiError.conflict(
      data.kind === "api"
        ? "You already have a monitor for this URL."
        : `You already have a monitor for "${data.url}"`,
    );
  const monitor = await Monitor.create({
    ...data,
    owner: ownerId,
    nextCheckAt: new Date(),
  });
  await logActivity({
    userId: ownerId,
    category: ACTIVITY_CATEGORIES.MONITOR,
    action: ACTIVITY_ACTIONS.MONITOR_CREATED,
    description: `Duplicated monitor "${source.name}" as "${monitor.name}"`,
    entityType: "Monitor",
    entityId: monitor._id,
    metadata:
      data.kind === "api"
        ? {
            kind: "api",
            interval: monitor.interval,
            duplicatedFrom: source._id,
          }
        : {
            url: monitor.url,
            interval: monitor.interval,
            duplicatedFrom: source._id,
          },
  });
  return monitor;
};

export const deleteMonitor = async (id, user) => {
  const ownerId = resolveOwnerId(user);

  const monitor = await Monitor.findOne({ _id: id, owner: ownerId });
  if (!monitor) {
    throw ApiError.notFound(`Monitor not found with id: ${id}`);
  }

  await Promise.all([
    HealthCheck.deleteMany({ monitor: monitor._id }),
    DailyStat.deleteMany({ monitor: monitor._id }),
    HourlyStat.deleteMany({ monitor: monitor._id }),
    PerformanceAlertState.deleteMany({ monitor: monitor._id }),
    RegionalCheck.deleteMany({ monitor: monitor._id }),
    RegionalProbeRun.deleteMany({ monitor: monitor._id }),
    RegionalIncident.deleteMany({ monitor: monitor._id }),
    RegionalDailyStat.deleteMany({ monitor: monitor._id }),
    RegionalHourlyStat.deleteMany({ monitor: monitor._id }),
    RegionalPerformanceState.deleteMany({ monitor: monitor._id }),
    Incident.deleteMany({ monitor: monitor._id }),
    StatusPage.updateMany(
      { "services.monitor": monitor._id },
      { $pull: { services: { monitor: monitor._id } } },
    ),
  ]);
  await monitor.deleteOne();

  await logActivity({
    userId: ownerId,
    category: ACTIVITY_CATEGORIES.MONITOR,
    action: ACTIVITY_ACTIONS.MONITOR_DELETED,
    description: `Deleted monitor "${monitor.name}"`,
    entityType: "Monitor",
    entityId: monitor._id,
    metadata: { url: monitor.url },
  });

  return monitor;
};
