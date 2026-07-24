import ApiError from "../utils/ApiError.js";
import { getPlanRank } from "../utils/planUtils.js";
import { getPlanDefinition } from "../config/plans.js";

/**
 * Requires the authenticated user's subscription plan to be one of
 * `allowedPlans` exactly (no rank comparison). Use this when a feature is
 * only available on specific tiers that aren't a simple "at least X"
 * relationship; for the common "this tier or higher" case, prefer
 * `requireMinPlan` below.
 */
export const requirePlan =
  (...allowedPlans) =>
  (req, _res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized("Please log in to continue"));
    }

    if (!allowedPlans.includes(req.user.plan)) {
      return next(
        ApiError.upgradeRequired(
          `This action requires one of the following plans: ${allowedPlans.join(", ")}.`,
        ),
      );
    }

    return next();
  };

/**
 * Requires the authenticated user's plan rank to be at least that of
 * `minimumPlan` (see config/plans.js for rank ordering — Free < Pro <
 * Unlimited). This is the middleware most routes should reach for, since
 * plan tiers are additive by design.
 */
export const requireMinPlan = (minimumPlan) => (req, _res, next) => {
  if (!req.user) {
    return next(ApiError.unauthorized("Please log in to continue"));
  }

  if (getPlanRank(req.user.plan) < getPlanRank(minimumPlan)) {
    const definition = getPlanDefinition(minimumPlan);
    return next(
      ApiError.upgradeRequired(
        `This action requires the ${definition?.name || minimumPlan} plan or higher.`,
        minimumPlan,
      ),
    );
  }

  return next();
};
