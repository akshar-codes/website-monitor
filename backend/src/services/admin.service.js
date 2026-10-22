import User from "../models/User.js";
import ApiKey from "../models/ApiKey.js";
import Monitor from "../models/Monitor.js";
import HealthCheck from "../models/HealthCheck.js";
import Incident from "../models/Incident.js";
import DailyStat from "../models/DailyStat.js";
import ApiError from "../utils/ApiError.js";
import logger from "../utils/logger.js";
import { escapeRegExp } from "../utils/regex.js";
import { ROLES } from "../config/constants.js";
import { changeUserPlan as changePlanForUser } from "./plan.service.js";
import { destroyAllUserSessions } from "./session.service.js";
import { logActivity } from "../utils/activityLogger.js";
import {
  ACTIVITY_CATEGORIES,
  ACTIVITY_ACTIONS,
} from "../config/activityConstants.js";

const resolveActingUserId = (actingUser) =>
  actingUser.id || actingUser._id.toString();

// ── List / search / filter ──────────────────────────────────────────────────

export const getUsers = async ({ page, limit, role, plan, status, search }) => {
  const filter = {};

  if (role) filter.role = role;
  if (plan) filter.plan = plan;
  if (status === "active") filter.active = true;
  if (status === "suspended") filter.active = false;

  if (search) {
    const pattern = new RegExp(escapeRegExp(search), "i");
    filter.$or = [{ name: pattern }, { email: pattern }];
  }

  const skip = (page - 1) * limit;

  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);

  return {
    users,
    total,
    page,
    totalPages: Math.ceil(total / limit) || 1,
  };
};

// ── Role management ──────────────────────────────────────────────────────────

/**
 * Updates a target user's role. Two invariants are enforced here rather
 * than left to the caller, since both are safety-critical and easy to
 * forget:
 *   1. An admin can never change their OWN role through this endpoint —
 *      prevents an accidental (or coerced) self-lockout.
 *   2. The last remaining admin can never be demoted — prevents the
 *      application from ending up with zero admins and no way to promote
 *      a new one without direct database access.
 */
export const updateUserRole = async (targetUserId, role, actingUser) => {
  const actingUserId = resolveActingUserId(actingUser);

  if (targetUserId === actingUserId) {
    throw ApiError.badRequest("You cannot change your own role");
  }

  const user = await User.findById(targetUserId);
  if (!user) {
    throw ApiError.notFound(`User not found with id: ${targetUserId}`);
  }

  if (user.role === ROLES.ADMIN && role !== ROLES.ADMIN) {
    const adminCount = await User.countDocuments({ role: ROLES.ADMIN });
    if (adminCount <= 1) {
      throw ApiError.badRequest(
        "Cannot remove the last remaining admin. Promote another user to admin first.",
      );
    }
  }

  const previousRole = user.role;
  user.role = role;
  // Role is not part of the password/validation chain — skip full
  // document revalidation the same way other metadata-only updates do
  // (e.g. recordLogin) to avoid re-checking unrelated fields.
  await user.save({ validateBeforeSave: false });

  await logActivity({
    userId: actingUserId,
    category: ACTIVITY_CATEGORIES.ADMIN,
    action: ACTIVITY_ACTIONS.ADMIN_USER_ROLE_CHANGED,
    description: `Changed ${user.email}'s role from ${previousRole} to ${role}`,
    entityType: "User",
    entityId: user._id,
    metadata: { targetEmail: user.email, from: previousRole, to: role },
  });

  return user;
};

// ── Plan management ──────────────────────────────────────────────────────────

/**
 * Thin admin-scoped wrapper around plan.service.js#changeUserPlan — the
 * upgrade/downgrade comparison, plan-history bookkeeping, and plan
 * validation already live there and must not be duplicated. This wrapper
 * only adds the admin-specific guard: an admin must use their own Billing
 * page to change their own plan, not this endpoint — keeps the audit
 * trail's "changedBy" semantics unambiguous (self-service vs.
 * admin-directed) and prevents an admin from granting themselves a plan
 * through a back door.
 */
export const updateUserPlan = async (targetUserId, plan, actingUser) => {
  const actingUserId = resolveActingUserId(actingUser);

  if (targetUserId === actingUserId) {
    throw ApiError.badRequest("Use the Billing page to change your own plan");
  }

  const result = await changePlanForUser(targetUserId, plan, actingUser);

  // plan.service.js already logs a PLAN-category entry on the target
  // user's own timeline; this additional ADMIN-category entry on the
  // acting admin's timeline is what surfaces the action in the admin's
  // own activity history.
  await logActivity({
    userId: actingUserId,
    category: ACTIVITY_CATEGORIES.ADMIN,
    action: ACTIVITY_ACTIONS.ADMIN_USER_PLAN_CHANGED,
    description: `Changed ${result.user.email}'s plan to ${plan}`,
    entityType: "User",
    entityId: result.user._id,
    metadata: { targetEmail: result.user.email, to: plan },
  });

  return result;
};

// ── Status management (suspend / reactivate) ────────────────────────────────

/**
 * Suspends a user account: flips `active` to false — which blocks future
 * logins, both local (see services/auth.service.js#validateCredentials)
 * and OAuth (see controllers/oauth.controller.js) — and immediately
 * destroys every session the account currently holds, so the suspension
 * takes effect on already-open devices rather than only on the next
 * login attempt.
 */
export const suspendUser = async (targetUserId, actingUser) => {
  const actingUserId = resolveActingUserId(actingUser);

  if (targetUserId === actingUserId) {
    throw ApiError.badRequest("You cannot suspend your own account");
  }

  const user = await User.findById(targetUserId);
  if (!user) {
    throw ApiError.notFound(`User not found with id: ${targetUserId}`);
  }

  if (!user.active) {
    throw ApiError.badRequest("User is already suspended");
  }

  if (user.role === ROLES.ADMIN) {
    const activeAdminCount = await User.countDocuments({
      role: ROLES.ADMIN,
      active: true,
    });
    if (activeAdminCount <= 1) {
      throw ApiError.badRequest(
        "Cannot suspend the last active admin. Promote another user to admin first.",
      );
    }
  }

  user.active = false;
  await user.save({ validateBeforeSave: false });

  const destroyedCount = await destroyAllUserSessions(targetUserId);

  logger.info(
    `User ${targetUserId} (${user.email}) suspended by admin ${actingUserId} — ${destroyedCount} session(s) invalidated`,
  );

  await logActivity({
    userId: actingUserId,
    category: ACTIVITY_CATEGORIES.ADMIN,
    action: ACTIVITY_ACTIONS.ADMIN_USER_SUSPENDED,
    description: `Suspended account ${user.email}`,
    entityType: "User",
    entityId: user._id,
    metadata: { targetEmail: user.email, sessionsInvalidated: destroyedCount },
  });

  return user;
};

/**
 * Reactivates a previously suspended user account.
 */
export const reactivateUser = async (targetUserId, actingUser) => {
  const actingUserId = resolveActingUserId(actingUser);

  const user = await User.findById(targetUserId);
  if (!user) {
    throw ApiError.notFound(`User not found with id: ${targetUserId}`);
  }

  if (user.active) {
    throw ApiError.badRequest("User is already active");
  }

  user.active = true;
  await user.save({ validateBeforeSave: false });

  logger.info(
    `User ${targetUserId} (${user.email}) reactivated by admin ${actingUserId}`,
  );

  await logActivity({
    userId: actingUserId,
    category: ACTIVITY_CATEGORIES.ADMIN,
    action: ACTIVITY_ACTIONS.ADMIN_USER_REACTIVATED,
    description: `Reactivated account ${user.email}`,
    entityType: "User",
    entityId: user._id,
    metadata: { targetEmail: user.email },
  });

  return user;
};

// ── Delete ───────────────────────────────────────────────────────────────────

/**
 * Permanently deletes a user account. Cascades the deletion to every
 * resource that references the user as `owner` (monitors) and every
 * resource that in turn references those monitors (health checks,
 * incidents, daily stats) — Monitor.owner is a required field, so leaving
 * these behind would orphan documents that can never again be reached
 * through an `{ owner }`-scoped query, and would keep counting against
 * nothing in aggregate reporting.
 *
 * Two invariants mirror updateUserRole's safety checks:
 *   1. An admin can never delete their OWN account through this endpoint.
 *   2. The last remaining admin can never be deleted.
 *
 * Note: the deleted user's OWN activity log is intentionally left as-is
 * (Activity documents reference `user` but aren't cascade-deleted here) —
 * an audit trail losing entries the moment the account it concerns is
 * removed would defeat its purpose. The acting admin's log records the
 * deletion itself.
 */
export const deleteUser = async (targetUserId, actingUser) => {
  const actingUserId = resolveActingUserId(actingUser);

  if (targetUserId === actingUserId) {
    throw ApiError.badRequest("You cannot delete your own account");
  }

  const user = await User.findById(targetUserId);
  if (!user) {
    throw ApiError.notFound(`User not found with id: ${targetUserId}`);
  }

  if (user.role === ROLES.ADMIN) {
    const adminCount = await User.countDocuments({ role: ROLES.ADMIN });
    if (adminCount <= 1) {
      throw ApiError.badRequest(
        "Cannot delete the last remaining admin. Promote another user to admin first.",
      );
    }
  }

  const ownedMonitorIds = await Monitor.find({ owner: targetUserId }).distinct(
    "_id",
  );

  if (ownedMonitorIds.length > 0) {
    await Promise.all([
      HealthCheck.deleteMany({ monitor: { $in: ownedMonitorIds } }),
      Incident.deleteMany({ monitor: { $in: ownedMonitorIds } }),
      DailyStat.deleteMany({ monitor: { $in: ownedMonitorIds } }),
    ]);
    await Monitor.deleteMany({ owner: targetUserId });
  }

  await destroyAllUserSessions(targetUserId);
  await ApiKey.deleteMany({ owner: targetUserId });
  await User.findByIdAndDelete(targetUserId);

  logger.info(
    `User ${targetUserId} (${user.email}) deleted by admin ${actingUserId} — cascaded ${ownedMonitorIds.length} monitor(s) and their dependent records`,
  );

  await logActivity({
    userId: actingUserId,
    category: ACTIVITY_CATEGORIES.ADMIN,
    action: ACTIVITY_ACTIONS.ADMIN_USER_DELETED,
    description: `Deleted account ${user.email}`,
    entityType: "User",
    entityId: targetUserId,
    metadata: {
      targetEmail: user.email,
      cascadedMonitors: ownedMonitorIds.length,
    },
  });

  return {
    deletedUserId: targetUserId,
    cascadedMonitors: ownedMonitorIds.length,
  };
};
