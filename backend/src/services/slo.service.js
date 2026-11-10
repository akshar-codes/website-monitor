import Slo from "../models/SLO.js";
import Monitor from "../models/Monitor.js";
import ApiError from "../utils/ApiError.js";
import { ROLES, SLO_ROLLING_WINDOW_MS } from "../config/constants.js";
import { hasFeature, FEATURES } from "../config/features.js";
import { getPlanDefinition } from "../config/plans.js";
import { getSloLimit } from "../utils/planUtils.js";
import { logActivity } from "../utils/activityLogger.js";
import {
  ACTIVITY_CATEGORIES,
  ACTIVITY_ACTIONS,
} from "../config/activityConstants.js";

const resolveOwnerId = (user) => (user.id || user._id).toString();

export const countOwnedSlos = (user, excludeId, model = Slo) =>
  model.countDocuments({
    owner: resolveOwnerId(user),
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  });

export const assertRollingWindowAllowedForPlan = (plan, rollingWindow) => {
  const definition = getPlanDefinition(plan);
  const retentionDays = definition?.limits.dataRetentionDays ?? 0;
  const windowDays =
    (SLO_ROLLING_WINDOW_MS[rollingWindow] || 0) / (24 * 60 * 60 * 1000);

  if (windowDays > retentionDays) {
    throw ApiError.upgradeRequired(
      `Your ${definition?.name || plan} plan retains ${retentionDays} days of data, which cannot cover a ${rollingWindow} rolling window. Upgrade to enable longer SLO windows.`,
    );
  }
};

export const assertSloAllowed = async (
  user,
  excludeId,
  countFn = countOwnedSlos,
) => {
  if (!hasFeature(user.plan, FEATURES.SLO_MANAGEMENT)) {
    throw ApiError.featureRestricted(
      "SLO & Error Budget tracking isn't available on your current plan.",
    );
  }
  const limit = getSloLimit(user.plan);
  const used = await countFn(user, excludeId);
  if (limit != null && used >= limit) {
    throw ApiError.upgradeRequired(
      `Your plan allows up to ${limit} SLO configuration${limit === 1 ? "" : "s"}. Upgrade to add more.`,
    );
  }
};

export const createSlo = async (data, user) => {
  if (user.role === ROLES.ADMIN) {
    throw ApiError.forbidden(
      "Admin accounts cannot create SLOs. SLOs are owned by individual user accounts.",
      "ROLE_FORBIDDEN",
    );
  }

  const ownerId = resolveOwnerId(user);

  await assertSloAllowed(user);
  if (data.rollingWindow) {
    assertRollingWindowAllowedForPlan(user.plan, data.rollingWindow);
  }

  // Validate target monitor exists and verify ownership
  const monitor = await Monitor.findById(data.monitorId);
  if (!monitor) {
    throw ApiError.notFound(`Monitor not found with id: ${data.monitorId}`);
  }

  if (monitor.owner.toString() !== ownerId) {
    throw ApiError.forbidden(
      "You do not have permission to configure an SLO for this monitor",
      "OWNERSHIP_REQUIRED",
    );
  }

  // Uniqueness check for name on the same monitor for this owner
  const existing = await Slo.findOne({
    owner: ownerId,
    monitor: data.monitorId,
    name: data.name,
  });
  if (existing) {
    throw ApiError.conflict(
      `An SLO with name "${data.name}" already exists for this monitor`,
    );
  }

  const slo = await Slo.create({
    owner: ownerId,
    monitor: data.monitorId,
    name: data.name,
    description: data.description || "",
    targetPercentage: data.targetPercentage,
    rollingWindow: data.rollingWindow || "30d",
    evaluationInterval: data.evaluationInterval || "1h",
    enabled: data.enabled !== undefined ? data.enabled : true,
    alertSettings: data.alertSettings || {},
    measurementContract: data.measurementContract || {},
    audit: {
      createdBy: ownerId,
      updatedBy: ownerId,
      changeHistory: [
        {
          changedAt: new Date(),
          changedBy: ownerId,
          action: "created",
          diff: null,
          reason: "Initial SLO configuration",
        },
      ],
    },
  });

  await logActivity({
    userId: ownerId,
    category: ACTIVITY_CATEGORIES.MONITOR,
    action: ACTIVITY_ACTIONS.SLO_CREATED,
    description: `Created SLO "${slo.name}"`,
    entityType: "Slo",
    entityId: slo._id,
    metadata: {
      monitorId: data.monitorId,
      targetPercentage: slo.targetPercentage,
      rollingWindow: slo.rollingWindow,
    },
  });

  return slo;
};

export const getSlos = async (
  {
    page = 1,
    limit = 20,
    monitorId,
    enabled,
    search,
    sortBy = "createdAt",
    order = "desc",
  },
  user,
) => {
  const ownerId = resolveOwnerId(user);
  const filter = { owner: ownerId };

  if (monitorId) {
    filter.monitor = monitorId;
  }
  if (enabled !== undefined) {
    filter.enabled = enabled;
  }
  if (search) {
    filter.name = { $regex: search, $options: "i" };
  }

  const sort = { [sortBy]: order === "asc" ? 1 : -1 };
  const skip = (page - 1) * limit;

  const [slos, total] = await Promise.all([
    Slo.find(filter)
      .populate("monitor", "name url kind interval")
      .sort(sort)
      .skip(skip)
      .limit(limit),
    Slo.countDocuments(filter),
  ]);

  return {
    slos,
    total,
    page,
    totalPages: Math.ceil(total / limit) || 1,
  };
};

export const getSloById = async (id, user) => {
  const ownerId = resolveOwnerId(user);
  const slo = await Slo.findById(id).populate(
    "monitor",
    "name url kind interval",
  );

  if (!slo) {
    throw ApiError.notFound(`SLO not found with id: ${id}`);
  }

  const isOwner = slo.owner.toString() === ownerId;
  const isAdmin = user.role === ROLES.ADMIN;

  if (!isOwner && !isAdmin) {
    throw ApiError.forbidden(
      "You do not have permission to access this resource",
      "OWNERSHIP_REQUIRED",
    );
  }

  return slo;
};

export const updateSlo = async (id, data, user) => {
  const ownerId = resolveOwnerId(user);
  const slo = await Slo.findById(id);

  if (!slo) {
    throw ApiError.notFound(`SLO not found with id: ${id}`);
  }

  const isOwner = slo.owner.toString() === ownerId;
  const isAdmin = user.role === ROLES.ADMIN;

  if (!isOwner && !isAdmin) {
    throw ApiError.forbidden(
      "You do not have permission to access this resource",
      "OWNERSHIP_REQUIRED",
    );
  }

  if (data.rollingWindow) {
    assertRollingWindowAllowedForPlan(user.plan, data.rollingWindow);
  }

  // Name uniqueness check on same monitor
  if (data.name && data.name !== slo.name) {
    const conflict = await Slo.findOne({
      owner: slo.owner,
      monitor: slo.monitor,
      name: data.name,
      _id: { $ne: slo._id },
    });
    if (conflict) {
      throw ApiError.conflict(
        `An SLO with name "${data.name}" already exists for this monitor`,
      );
    }
  }

  // Compute diff for audit trail
  const diff = {};
  const updatableFields = [
    "name",
    "description",
    "targetPercentage",
    "rollingWindow",
    "evaluationInterval",
    "enabled",
    "alertSettings",
    "measurementContract",
  ];

  let hasChanges = false;
  for (const field of updatableFields) {
    if (data[field] !== undefined) {
      const oldVal = slo[field];
      const newVal = data[field];
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        diff[field] = { from: oldVal, to: newVal };
        slo[field] = newVal;
        hasChanges = true;
      }
    }
  }

  if (hasChanges) {
    slo.audit.updatedBy = ownerId;
    slo.audit.changeHistory.push({
      changedAt: new Date(),
      changedBy: ownerId,
      action:
        data.enabled !== undefined && diff.enabled
          ? "status_changed"
          : "updated",
      diff,
      reason: data.changeReason || null,
    });
  }

  await slo.save();

  await logActivity({
    userId: ownerId,
    category: ACTIVITY_CATEGORIES.MONITOR,
    action: ACTIVITY_ACTIONS.SLO_UPDATED,
    description: `Updated SLO "${slo.name}"`,
    entityType: "Slo",
    entityId: slo._id,
    metadata: { diff, reason: data.changeReason || null },
  });

  return slo;
};

export const deleteSlo = async (id, user) => {
  const ownerId = resolveOwnerId(user);
  const slo = await Slo.findById(id);

  if (!slo) {
    throw ApiError.notFound(`SLO not found with id: ${id}`);
  }

  const isOwner = slo.owner.toString() === ownerId;
  const isAdmin = user.role === ROLES.ADMIN;

  if (!isOwner && !isAdmin) {
    throw ApiError.forbidden(
      "You do not have permission to access this resource",
      "OWNERSHIP_REQUIRED",
    );
  }

  await slo.deleteOne();

  await logActivity({
    userId: ownerId,
    category: ACTIVITY_CATEGORIES.MONITOR,
    action: ACTIVITY_ACTIONS.SLO_DELETED,
    description: `Deleted SLO "${slo.name}"`,
    entityType: "Slo",
    entityId: slo._id,
    metadata: { monitorId: slo.monitor, name: slo.name },
  });

  return slo;
};
