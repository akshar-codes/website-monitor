import Monitor from "../models/Monitor.js";
import HealthCheck from "../models/HealthCheck.js";
import DailyStat from "../models/DailyStat.js";
import Incident from "../models/Incident.js";
import ApiError from "../utils/ApiError.js";
import { ROLES } from "../config/constants.js";
import {
  isIntervalAllowedForPlan,
  getMinCheckInterval,
} from "../utils/planUtils.js";
import { logActivity } from "../utils/activityLogger.js";
import {
  ACTIVITY_CATEGORIES,
  ACTIVITY_ACTIONS,
} from "../config/activityConstants.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

const resolveOwnerId = (user) => user.id || user._id.toString();

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

  assertIntervalAllowedForPlan(user.plan, data.interval);

  const existing = await Monitor.findOne({ owner: ownerId, url: data.url });
  if (existing) {
    throw ApiError.conflict(`You already have a monitor for "${data.url}"`);
  }

  const monitor = await Monitor.create({ ...data, owner: ownerId });

  await logActivity({
    userId: ownerId,
    category: ACTIVITY_CATEGORIES.MONITOR,
    action: ACTIVITY_ACTIONS.MONITOR_CREATED,
    description: `Created monitor "${monitor.name}"`,
    entityType: "Monitor",
    entityId: monitor._id,
    metadata: { url: monitor.url, interval: monitor.interval },
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

  if (data.interval !== undefined) {
    assertIntervalAllowedForPlan(user.plan, data.interval);
  }

  if (data.url) {
    const existing = await Monitor.findOne({
      owner: ownerId,
      url: data.url,
      _id: { $ne: id },
    });
    if (existing) {
      throw ApiError.conflict(`You already have a monitor for "${data.url}"`);
    }
  }

  const previous = await Monitor.findOne({ _id: id, owner: ownerId })
    .select("active")
    .lean();

  // Reactivating a monitor schedules an immediate re-check.
  if (data.active === true) {
    data.nextCheckAt = new Date();
  }

  const monitor = await Monitor.findOneAndUpdate(
    { _id: id, owner: ownerId },
    data,
    { returnDocument: "after", runValidators: true },
  );

  if (!monitor) {
    throw ApiError.notFound(`Monitor not found with id: ${id}`);
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
  assertIntervalAllowedForPlan(user.plan, data.interval);
  const existing = await Monitor.findOne({ owner: ownerId, url: data.url });
  if (existing)
    throw ApiError.conflict(`You already have a monitor for "${data.url}"`);
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
    metadata: {
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
    Incident.deleteMany({ monitor: monitor._id }),
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
