import PlanUpgradeRequest from "../models/PlanUpgradeRequest.js";
import User from "../models/User.js";
import ApiError from "../utils/ApiError.js";
import logger from "../utils/logger.js";
import { PLAN_UPGRADE_REQUEST_STATUS, ROLES } from "../config/constants.js";
import { getPlanDefinition } from "../config/plans.js";
import { isUpgrade } from "../utils/planUtils.js";
import { changeUserPlan } from "./plan.service.js";
import { getBillingSettings } from "./billingSettings.service.js";
import {
  createNotification,
  createNotificationForUsers,
} from "./notification.service.js";
import {
  NOTIFICATION_TYPES,
  NOTIFICATION_PRIORITIES,
} from "../config/notificationConstants.js";
import {
  sendPlanUpgradeRequestApprovedEmail,
  sendPlanUpgradeRequestRejectedEmail,
  sendPlanUpgradeRequestSubmittedEmail,
} from "./email.service.js";
import { logActivity } from "../utils/activityLogger.js";
import {
  ACTIVITY_CATEGORIES,
  ACTIVITY_ACTIONS,
} from "../config/activityConstants.js";

const resolveUserId = (user) => user.id || user._id.toString();

// ── Create (user-facing) ──────────────────────────────────────────────────────

/**
 * Submits a manual upgrade request. Only upgrades go through this flow —
 * there is no payment gateway wired up (see config/plans.js#PLAN_DEFINITIONS
 * and User.billing), so a requested plan change to a HIGHER tier must be
 * reviewed by an admin before it takes effect. Downgrades remain
 * self-service and instant via POST /api/plans/change — they carry no
 * revenue/payment-verification concern.
 *
 * At most one pending request per user at a time — a second request while
 * one is already pending is rejected outright rather than silently
 * replacing it, so the admin queue never has to reason about superseded
 * requests.
 */
export const createUpgradeRequest = async (user, requestedPlan) => {
  const billingSettings = await getBillingSettings();
  if (billingSettings.mode === "payment")
    throw ApiError.badRequest(
      "Plan upgrades use direct checkout. Choose a paid plan from Plans & billing.",
    );
  const definition = getPlanDefinition(requestedPlan);
  if (!definition) {
    throw ApiError.badRequest(`Unknown plan: ${requestedPlan}`);
  }

  if (requestedPlan === user.plan) {
    throw ApiError.badRequest(
      `You are already subscribed to the ${definition.name} plan`,
    );
  }

  if (!isUpgrade(user.plan, requestedPlan)) {
    throw ApiError.badRequest(
      "Only plan upgrades require a request. Downgrades take effect immediately via the plan change endpoint.",
    );
  }

  const userId = resolveUserId(user);

  const existingPending =
    await PlanUpgradeRequest.findActivePendingForUser(userId);
  if (existingPending) {
    throw ApiError.conflict(
      "You already have a pending upgrade request. Please wait for it to be reviewed before submitting another.",
    );
  }

  const request = await PlanUpgradeRequest.create({
    user: userId,
    currentPlan: user.plan,
    requestedPlan,
    status: PLAN_UPGRADE_REQUEST_STATUS.PENDING,
  });

  await logActivity({
    userId,
    category: ACTIVITY_CATEGORIES.PLAN,
    action: ACTIVITY_ACTIONS.PLAN_UPGRADE_REQUESTED,
    description: `Requested an upgrade from ${user.plan} to ${requestedPlan}`,
    entityType: "PlanUpgradeRequest",
    entityId: request._id,
    metadata: { from: user.plan, to: requestedPlan },
  });

  logger.info(
    `Plan upgrade request ${request._id} created by user ${userId}: ${user.plan} -> ${requestedPlan}`,
  );

  try {
    const admins = await User.find({ role: ROLES.ADMIN, active: true })
      .select("name email")
      .lean();

    await createNotificationForUsers(
      admins.map((admin) => admin._id),
      {
        type: NOTIFICATION_TYPES.PLAN_UPGRADE_REQUEST_SUBMITTED,
        title: "New plan upgrade request",
        message: `${user.name || user.email} requested an upgrade from ${user.plan} to ${requestedPlan}.`,
        priority: NOTIFICATION_PRIORITIES.HIGH,
        link: "/admin/plan-requests",
        relatedResource: {
          resourceType: "PlanUpgradeRequest",
          resourceId: request._id,
        },
      },
    );

    void Promise.allSettled(
      admins.map((admin) =>
        sendPlanUpgradeRequestSubmittedEmail(
          admin,
          user,
          user.plan,
          requestedPlan,
        ),
      ),
    ).then((emailResults) => {
      emailResults.forEach((result, index) => {
        if (result.status === "rejected") {
          logger.error(
            `Failed to email admin ${admins[index].email} about plan upgrade request ${request._id}: ${result.reason.message}`,
            { stack: result.reason.stack },
          );
        }
      });
    });
  } catch (error) {
    // The request is already persisted. Notification delivery failures must
    // not make the user believe their submission failed.
    logger.error(
      `Failed to notify admins about plan upgrade request ${request._id}: ${error.message}`,
      { stack: error.stack },
    );
  }

  return request;
};

// ── Read (user-facing) ────────────────────────────────────────────────────────

/**
 * The caller's currently pending request (or null) plus their most recent
 * request history — powers the Billing page's "pending" banner and
 * disables further plan actions while a request is outstanding.
 */
export const getRequestsForUser = async (user, { historyLimit = 5 } = {}) => {
  const userId = resolveUserId(user);

  const [pending, history] = await Promise.all([
    PlanUpgradeRequest.findActivePendingForUser(userId),
    PlanUpgradeRequest.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(historyLimit)
      .lean(),
  ]);

  return { pending, history };
};

// ── Admin: list ────────────────────────────────────────────────────────────────

export const listRequestsForAdmin = async ({ page, limit, status }) => {
  const filter = {};
  if (status) filter.status = status;

  const skip = (page - 1) * limit;

  // Pending requests are reviewed oldest-first (FIFO queue); already-
  // reviewed requests are more useful newest-first (recent decisions).
  const sort =
    !status || status === PLAN_UPGRADE_REQUEST_STATUS.PENDING
      ? { createdAt: 1 }
      : { createdAt: -1 };

  const [requests, total] = await Promise.all([
    PlanUpgradeRequest.find(filter)
      .populate("user", "name email plan")
      .populate("reviewedBy", "name email")
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    PlanUpgradeRequest.countDocuments(filter),
  ]);

  return {
    requests,
    total,
    page,
    totalPages: Math.ceil(total / limit) || 1,
  };
};

export const getRequestForAdmin = async (requestId) => {
  const request = await PlanUpgradeRequest.findById(requestId)
    .populate("user", "name email role plan planStatus active")
    .populate("reviewedBy", "name")
    .lean();
  if (!request)
    throw ApiError.notFound(
      `Plan upgrade request not found with id: ${requestId}`,
    );
  return request;
};

// ── Admin: approve ───────────────────────────────────────────────────────────

/**
 * Approves a pending upgrade request: applies the plan change via
 * plan.service.js#changeUserPlan (which owns plan-history bookkeeping and
 * logs a PLAN-category activity entry on the target user's own timeline —
 * "Plan upgraded from X to Y by an administrator"), marks the request
 * reviewed, then notifies the requester by email and in-app notification.
 *
 * Reusing changeUserPlan here (rather than setting user.plan directly)
 * means this flow can never drift from the self-service upgrade/downgrade
 * path — there is exactly one place a user's plan is ever changed.
 */
export const approveRequest = async (
  requestId,
  adminUser,
  {
    grantedPlan,
    reason,
    expiresAt,
    paymentRequired = false,
    period = "monthly",
    discountPercent = 0,
    planExpiresAt = null,
  } = {},
) => {
  const billingSettings = await getBillingSettings();
  if (billingSettings.mode === "payment" && !paymentRequired)
    throw ApiError.badRequest(
      "Direct payment mode is active. Choose a payment offer for this request.",
    );
  const request = await PlanUpgradeRequest.findById(requestId);
  if (!request) {
    throw ApiError.notFound(
      `Plan upgrade request not found with id: ${requestId}`,
    );
  }

  if (request.status !== PLAN_UPGRADE_REQUEST_STATUS.PENDING) {
    throw ApiError.badRequest(
      `This request has already been ${request.status} and cannot be reviewed again`,
    );
  }

  const adminId = adminUser.id || adminUser._id.toString();

  const actualPlan = grantedPlan || request.requestedPlan;
  const currentUser = await User.findById(request.user).select("plan");
  if (!currentUser)
    throw ApiError.notFound("The user for this request no longer exists");
  if (currentUser.plan !== request.currentPlan) {
    throw ApiError.conflict(
      "The user's plan changed after this request was submitted. Review the current plan before approving.",
    );
  }
  if (!isUpgrade(currentUser.plan, actualPlan)) {
    throw ApiError.badRequest(
      "An upgrade request can only grant a higher plan than the user's current plan.",
    );
  }

  if (paymentRequired) {
    if (!billingSettings.paymentReady || billingSettings.currency !== "INR") {
      throw ApiError.badRequest(
        "Payment offers require configured Razorpay checkout with INR pricing.",
      );
    }
    const amount = billingSettings.prices?.[actualPlan]?.[period];
    if (!Number.isFinite(amount) || amount <= 0)
      throw ApiError.badRequest(
        "The selected plan has no valid price for this billing period.",
      );
    request.status = PLAN_UPGRADE_REQUEST_STATUS.PAYMENT_PENDING;
    request.grantedPlan = actualPlan;
    request.reviewedBy = adminId;
    request.reviewedAt = new Date();
    request.paymentOffer = {
      plan: actualPlan,
      period,
      discountPercent,
      expiresAt: planExpiresAt,
    };
    await request.save();
    await createNotification({
      ownerId: request.user,
      type: NOTIFICATION_TYPES.PLAN_UPGRADE_REQUEST_APPROVED,
      title: "A discounted plan offer is ready",
      message: `Your request was approved. Complete payment for the ${actualPlan} plan${discountPercent ? ` with a ${discountPercent}% discount` : ""} from Plans & billing.`,
      priority: NOTIFICATION_PRIORITIES.HIGH,
      link: "/billing",
      relatedResource: {
        resourceType: "PlanUpgradeRequest",
        resourceId: request._id,
      },
    });
    await logActivity({
      userId: adminId,
      category: ACTIVITY_CATEGORIES.ADMIN,
      action: ACTIVITY_ACTIONS.ADMIN_PLAN_UPGRADE_REQUEST_APPROVED,
      description: `Sent ${actualPlan} payment offer to ${currentUser.email}${discountPercent ? ` with ${discountPercent}% discount` : ""}`,
      entityType: "PlanUpgradeRequest",
      entityId: request._id,
      metadata: {
        targetEmail: currentUser.email,
        to: actualPlan,
        period,
        discountPercent,
        planExpiresAt,
      },
    });
    return { request, user: currentUser };
  }

  const { user: updatedUser } = await changeUserPlan(
    request.user,
    actualPlan,
    adminUser,
    { reason, expiresAt: expiresAt || null },
  );

  request.status = PLAN_UPGRADE_REQUEST_STATUS.APPROVED;
  request.reviewedBy = adminId;
  request.reviewedAt = new Date();
  if (grantedPlan) {
    request.grantedPlan = grantedPlan;
  }
  await request.save();

  await logActivity({
    userId: adminId,
    category: ACTIVITY_CATEGORIES.ADMIN,
    action: ACTIVITY_ACTIONS.ADMIN_PLAN_UPGRADE_REQUEST_APPROVED,
    description: `Approved ${updatedUser.email}'s upgrade request to ${actualPlan}${grantedPlan ? " (overridden)" : ""}: ${reason}`,
    entityType: "PlanUpgradeRequest",
    entityId: request._id,
    metadata: {
      targetEmail: updatedUser.email,
      from: request.currentPlan,
      to: actualPlan,
      originalRequest: request.requestedPlan,
      reason,
      expiresAt: expiresAt || null,
    },
  });

  await logActivity({
    userId: request.user,
    category: ACTIVITY_CATEGORIES.PLAN,
    action: ACTIVITY_ACTIONS.PLAN_UPGRADE_REQUEST_APPROVED,
    description: `Your upgrade request to ${actualPlan} was approved`,
    entityType: "PlanUpgradeRequest",
    entityId: request._id,
    metadata: { to: actualPlan },
  });

  // Notification/email failures must never fail the approval itself — the
  // plan change has already been persisted at this point.
  await createNotification({
    ownerId: request.user,
    type: NOTIFICATION_TYPES.PLAN_UPGRADE_REQUEST_APPROVED,
    title: "Your plan upgrade was approved",
    message: `Your request to upgrade has been approved and you are now on the ${actualPlan} plan.`,
    priority: NOTIFICATION_PRIORITIES.HIGH,
    link: "/billing",
    relatedResource: {
      resourceType: "PlanUpgradeRequest",
      resourceId: request._id,
    },
  });

  try {
    await sendPlanUpgradeRequestApprovedEmail(updatedUser, actualPlan);
  } catch (error) {
    logger.error(
      `Failed to send plan-upgrade-approved email to ${updatedUser.email}: ${error.message}`,
      { stack: error.stack },
    );
  }

  logger.info(
    `Plan upgrade request ${request._id} approved by admin ${adminId} — user ${request.user} moved to ${actualPlan}`,
  );

  return { request, user: updatedUser };
};

// ── Admin: reject ─────────────────────────────────────────────────────────────

export const rejectRequest = async (requestId, adminUser, { reason } = {}) => {
  const request = await PlanUpgradeRequest.findById(requestId);
  if (!request) {
    throw ApiError.notFound(
      `Plan upgrade request not found with id: ${requestId}`,
    );
  }

  if (request.status !== PLAN_UPGRADE_REQUEST_STATUS.PENDING) {
    throw ApiError.badRequest(
      `This request has already been ${request.status} and cannot be reviewed again`,
    );
  }

  const targetUser = await User.findById(request.user).select("name email");
  if (!targetUser) {
    throw ApiError.notFound("The user for this request no longer exists");
  }

  const adminId = adminUser.id || adminUser._id.toString();

  request.status = PLAN_UPGRADE_REQUEST_STATUS.REJECTED;
  request.reviewedBy = adminId;
  request.reviewedAt = new Date();
  request.rejectionReason = reason || null;
  await request.save();

  await logActivity({
    userId: adminId,
    category: ACTIVITY_CATEGORIES.ADMIN,
    action: ACTIVITY_ACTIONS.ADMIN_PLAN_UPGRADE_REQUEST_REJECTED,
    description: `Rejected ${targetUser.email}'s upgrade request to ${request.requestedPlan}`,
    entityType: "PlanUpgradeRequest",
    entityId: request._id,
    metadata: {
      targetEmail: targetUser.email,
      to: request.requestedPlan,
      reason: reason || null,
    },
  });

  await logActivity({
    userId: targetUser._id,
    category: ACTIVITY_CATEGORIES.PLAN,
    action: ACTIVITY_ACTIONS.PLAN_UPGRADE_REQUEST_REJECTED,
    description: `Your upgrade request to ${request.requestedPlan} was rejected`,
    entityType: "PlanUpgradeRequest",
    entityId: request._id,
    metadata: { to: request.requestedPlan, reason: reason || null },
  });

  await createNotification({
    ownerId: targetUser._id,
    type: NOTIFICATION_TYPES.PLAN_UPGRADE_REQUEST_REJECTED,
    title: "Your plan upgrade request was declined",
    message: reason
      ? `Your request to upgrade to the ${request.requestedPlan} plan was declined: ${reason}`
      : `Your request to upgrade to the ${request.requestedPlan} plan was declined.`,
    priority: NOTIFICATION_PRIORITIES.NORMAL,
    link: "/billing",
    relatedResource: {
      resourceType: "PlanUpgradeRequest",
      resourceId: request._id,
    },
  });

  try {
    await sendPlanUpgradeRequestRejectedEmail(
      targetUser,
      request.requestedPlan,
      reason,
    );
  } catch (error) {
    logger.error(
      `Failed to send plan-upgrade-rejected email to ${targetUser.email}: ${error.message}`,
      { stack: error.stack },
    );
  }

  logger.info(
    `Plan upgrade request ${request._id} rejected by admin ${adminId} for user ${targetUser._id}`,
  );

  return request;
};
