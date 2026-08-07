import ApiError from "../utils/ApiError.js";
import { hasFeature } from "../config/features.js";
import { getPlanDefinition } from "../config/plans.js";
import { WINDOW_MS } from "../config/constants.js";
import { daysBetween } from "../utils/dateUtils.js";

/**
 * Requires the authenticated user's plan to include `featureKey`
 */
export const requireFeature = (featureKey, message) => (req, _res, next) => {
  if (!req.user) {
    return next(ApiError.unauthorized("Please log in to continue"));
  }

  if (!hasFeature(req.user.plan, featureKey)) {
    return next(
      ApiError.featureRestricted(
        message || "This feature isn't available on your current plan.",
      ),
    );
  }

  return next();
};

/**
 * Enforces a numeric per-plan usage limit against a live count
 */
export const requireWithinLimit =
  ({ limitFn, countFn, resourceName = "resource" }) =>
  async (req, _res, next) => {
    try {
      if (!req.user) {
        return next(ApiError.unauthorized("Please log in to continue"));
      }

      const limit = limitFn(req.user.plan);
      if (limit == null) {
        return next(); // null/undefined limit means unlimited
      }

      const currentCount = await countFn(req);
      if (currentCount >= limit) {
        return next(
          ApiError.upgradeRequired(
            `You've reached your plan's limit of ${limit} ${resourceName}${
              limit === 1 ? "" : "s"
            }. Upgrade to add more.`,
          ),
        );
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };

/**
 * Number of days each named time window (see config/constants.js#WINDOW_MS)
 */
const WINDOW_DAYS = Object.fromEntries(
  Object.entries(WINDOW_MS).map(([key, ms]) => [
    key,
    ms / (24 * 60 * 60 * 1000),
  ]),
);

/**
 * Enforces each plan's `dataRetentionDays` limit (see config/plans.js)
 */
export const requireWindowWithinRetention = (req, _res, next) => {
  if (!req.user) {
    return next(ApiError.unauthorized("Please log in to continue"));
  }

  const window = req.validatedQuery?.window;
  if (!window) {
    return next(); // route doesn't accept a window param — nothing to enforce
  }

  const definition = getPlanDefinition(req.user.plan);
  const retentionDays = definition?.limits.dataRetentionDays ?? 0;
  const windowDays = WINDOW_DAYS[window] ?? 0;

  if (windowDays > retentionDays) {
    return next(
      ApiError.upgradeRequired(
        `Your ${definition?.name || req.user.plan} plan only retains ${retentionDays} day${
          retentionDays === 1 ? "" : "s"
        } of data. Upgrade to access the ${window} view.`,
      ),
    );
  }

  return next();
};

/**
 * Analytics-specific variant of requireWindowWithinRetention
 */
export const requireAnalyticsRangeWithinRetention = (req, _res, next) => {
  if (!req.user) {
    return next(ApiError.unauthorized("Please log in to continue"));
  }

  const { window, startDate, endDate } = req.validatedQuery || {};

  const definition = getPlanDefinition(req.user.plan);
  const retentionDays = definition?.limits.dataRetentionDays ?? 0;

  const requestedDays =
    startDate && endDate
      ? daysBetween(startDate, endDate)
      : (WINDOW_DAYS[window || "30d"] ?? 30);

  if (requestedDays > retentionDays) {
    return next(
      ApiError.upgradeRequired(
        `Your ${definition?.name || req.user.plan} plan only retains ${retentionDays} day${
          retentionDays === 1 ? "" : "s"
        } of data. Upgrade to analyze a longer range.`,
      ),
    );
  }

  return next();
};
