import User from "../models/User.js";
import { PLANS, PLAN_STATUS } from "../config/constants.js";
import { logActivity } from "../utils/activityLogger.js";
import {
  ACTIVITY_CATEGORIES,
  ACTIVITY_ACTIONS,
} from "../config/activityConstants.js";
import logger from "../utils/logger.js";

const isExpired = (user, now = new Date()) => {
  if (user.plan === PLANS.FREE) return false;
  if (user.planStatus === PLAN_STATUS.EXPIRED) return true;
  if (user.planStatus === PLAN_STATUS.SUSPENDED) return true;
  if (user.planRenewsAt && user.planRenewsAt <= now) return true;
  return user.planStatus === PLAN_STATUS.CANCELED && !user.planRenewsAt;
};

/** Expire a paid plan at its configured end date and restore Free-tier limits. */
export const expireSubscriptionIfDue = async (user) => {
  if (!isExpired(user)) return user;
  const fresh = await User.findById(user.id || user._id).select("+planHistory");
  if (!fresh || !isExpired(fresh)) return fresh || user;

  const previousPlan = fresh.plan;
  const endedAt = fresh.planRenewsAt || new Date();
  const finalStatus =
    fresh.planStatus === PLAN_STATUS.SUSPENDED
      ? PLAN_STATUS.SUSPENDED
      : PLAN_STATUS.EXPIRED;
  const canceledAt = fresh.planCanceledAt;
  fresh.changePlan(PLANS.FREE, null);
  fresh.planStatus = finalStatus;
  fresh.planCanceledAt = canceledAt;
  fresh.planExpiredAt = endedAt;
  await fresh.save({ validateBeforeSave: false });

  try {
    await logActivity({
      userId: fresh._id,
      category: ACTIVITY_CATEGORIES.PLAN,
      action: ACTIVITY_ACTIONS.PLAN_DOWNGRADED,
      description: `Subscription expired; plan changed from ${previousPlan} to Free`,
      metadata: {
        from: previousPlan,
        to: PLANS.FREE,
        reason: "subscription_expired",
      },
    });
  } catch (error) {
    logger.warn(
      `Could not record subscription expiry for user ${fresh._id}: ${error.message}`,
    );
  }
  return fresh;
};
