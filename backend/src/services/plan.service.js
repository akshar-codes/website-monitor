import User from "../models/User.js";
import ApiError from "../utils/ApiError.js";
import logger from "../utils/logger.js";
import { getPlanDefinition, getPublicPlanCatalog } from "../config/plans.js";
import { getChangeType } from "../utils/planUtils.js";

// ── Catalog ──────────────────────────────────────────────────────────────────

/** Full public plan catalog (pricing, limits, feature copy), ranked. */
export const getPlanCatalog = () => getPublicPlanCatalog();

// ── Current plan ─────────────────────────────────────────────────────────────

/**
 * Projects a user document's plan fields alongside the full plan
 * definition, for the "what am I currently subscribed to" view.
 */
export const getCurrentPlanForUser = (user) => {
  const definition = getPlanDefinition(user.plan);

  return {
    plan: user.plan,
    status: user.planStatus,
    startedAt: user.planStartedAt,
    renewsAt: user.planRenewsAt,
    canceledAt: user.planCanceledAt,
    definition,
  };
};

// ── Upgrade / downgrade ──────────────────────────────────────────────────────

/**
 * Changes a user's subscription plan and records the transition in their
 * plan history for audit purposes.
 *
 * NOTE — future payment integration: paid-tier upgrades will eventually
 * need to gate on a confirmed payment (e.g. a Stripe Checkout session
 * completing, or a subscription webhook firing) before this function is
 * reached, rather than being called directly from the request handler.
 * The User model's `billing` fields (provider/customerId/subscriptionId)
 * exist for that integration. Until it lands, every plan change — upgrade
 * or downgrade — takes effect immediately.
 */
export const changeUserPlan = async (userId, targetPlan, actingUser = null) => {
  const definition = getPlanDefinition(targetPlan);
  if (!definition) {
    throw ApiError.badRequest(`Unknown plan: ${targetPlan}`);
  }

  // planHistory is select:false — explicitly re-select it so the audit
  // trail is appended to, not silently overwritten by a fresh array.
  const user = await User.findById(userId).select("+planHistory");
  if (!user) {
    throw ApiError.notFound(`User not found with id: ${userId}`);
  }

  if (user.plan === targetPlan) {
    throw ApiError.badRequest(
      `Already subscribed to the ${definition.name} plan`,
    );
  }

  const changeType = getChangeType(user.plan, targetPlan);

  const actingUserId = actingUser
    ? actingUser.id || actingUser._id?.toString()
    : null;
  const isSelfService = !actingUserId || actingUserId === userId.toString();

  user.changePlan(targetPlan, isSelfService ? null : actingUserId);
  await user.save({ validateBeforeSave: false });

  logger.info(
    `Plan ${changeType} for user ${user._id}: -> "${targetPlan}"${
      isSelfService ? "" : ` (changed by ${actingUserId})`
    }`,
  );

  return { user, changeType };
};
