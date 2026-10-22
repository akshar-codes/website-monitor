import mongoose from "mongoose";
import Activity from "../models/Activity.js";
import User from "../models/User.js";
import { escapeRegExp } from "../utils/regex.js";
import {
  redactActivityText,
  sanitizeActivityMetadata,
} from "../utils/activityRedaction.js";

const SECURITY_ACTIONS = new Set([
  "login",
  "logout",
  "logout_all",
  "logout_others",
  "password_changed",
  "password_reset_completed",
  "session_revoked",
]);
const present = (entry, targetUsers = new Map()) => {
  const targetId = entry.entityId ? String(entry.entityId) : null;
  const target =
    entry.entityType === "User" && targetId ? targetUsers.get(targetId) : null;
  const outcome = entry.outcome || "success";
  const securityRelated =
    outcome === "failure" ||
    entry.category === "auth" ||
    entry.category === "session" ||
    SECURITY_ACTIONS.has(entry.action);
  return {
    id: String(entry._id),
    eventType: entry.action,
    category: entry.category,
    actor: entry.user
      ? {
          id: String(entry.user._id),
          name: entry.user.name,
          email: entry.user.email,
          role: entry.user.role,
        }
      : null,
    target: targetId
      ? {
          id: targetId,
          type: entry.entityType || "Resource",
          name: target?.name || null,
          email: target?.email || null,
          plan: target?.plan || null,
        }
      : null,
    timestamp: entry.createdAt,
    outcome,
    securityRelated,
    description: redactActivityText(entry.description),
    metadata: sanitizeActivityMetadata(entry.metadata || {}),
  };
};

export const listAdminAuditEvents = async ({
  page,
  limit,
  startDate,
  endDate,
  actorId,
  targetId,
  category,
  outcome,
  search,
}) => {
  const filter = {
    category: category || { $in: ["admin", "auth", "session"] },
  };
  const conditions = [];
  if (actorId) filter.user = new mongoose.Types.ObjectId(actorId);
  if (targetId) {
    const id = new mongoose.Types.ObjectId(targetId);
    conditions.push({ $or: [{ entityId: id }, { user: id }] });
  }
  if (outcome === "failure") filter.outcome = "failure";
  if (outcome === "success")
    conditions.push({
      $or: [{ outcome: "success" }, { outcome: { $exists: false } }],
    });
  if (startDate && endDate)
    filter.createdAt = { $gte: startDate, $lte: endDate };
  if (search) {
    const regex = new RegExp(escapeRegExp(search), "i");
    conditions.push({
      $or: [{ description: regex }, { action: regex }, { entityType: regex }],
    });
  }
  if (conditions.length) filter.$and = conditions;
  const skip = (page - 1) * limit;
  const [records, total] = await Promise.all([
    Activity.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .select(
        "user category action description outcome entityType entityId metadata createdAt",
      )
      .populate("user", "name email role")
      .lean(),
    Activity.countDocuments(filter),
  ]);
  const targetIds = [
    ...new Set(
      records
        .filter((record) => record.entityType === "User" && record.entityId)
        .map((record) => String(record.entityId)),
    ),
  ];
  const targets = targetIds.length
    ? await User.find({ _id: { $in: targetIds } })
        .select("name email plan")
        .lean()
    : [];
  const targetMap = new Map(targets.map((user) => [String(user._id), user]));
  return {
    events: records.map((entry) => present(entry, targetMap)),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
  };
};

export const getAdminAuditEvent = async (id) => {
  const entry = await Activity.findById(id)
    .select(
      "user category action description outcome entityType entityId metadata createdAt",
    )
    .populate("user", "name email role")
    .lean();
  if (!entry || !["admin", "auth", "session"].includes(entry.category))
    return null;
  const targets =
    entry.entityType === "User" && entry.entityId
      ? await User.findById(entry.entityId).select("name email plan").lean()
      : null;
  return present(
    entry,
    new Map(targets ? [[String(targets._id), targets]] : []),
  );
};

export const recordFailedAdminOperation = async ({
  admin,
  method,
  path,
  statusCode,
}) => {
  const userId = admin?.id || admin?._id;
  if (!userId) return;
  const { logActivity } = await import("../utils/activityLogger.js");
  const targetMatch = path.match(
    /\/(users|monitors|incidents|plan-upgrade-requests)\/([a-f\d]{24})(?:\/|$)/i,
  );
  const entityType = targetMatch
    ? {
        users: "User",
        monitors: "Monitor",
        incidents: "Incident",
        "plan-upgrade-requests": "PlanUpgradeRequest",
      }[targetMatch[1].toLowerCase()]
    : null;
  await logActivity({
    userId,
    category: "admin",
    action: "admin_action_failed",
    outcome: "failure",
    description: `Administrative ${method} request failed (${statusCode}) at ${path}`,
    entityType,
    entityId: targetMatch?.[2] || null,
    metadata: { method, statusCode, path },
  });
};
