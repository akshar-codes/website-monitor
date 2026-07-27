import ApiError from "../utils/ApiError.js";
import { hasFeature } from "../config/features.js";
import { getPlanDefinition } from "../config/plans.js";
import { WINDOW_MS } from "../config/constants.js";

/**
 * Requires the authenticated user's plan to include `featureKey` (see
 * config/features.js). Distinct from planAuthorization.js's rank-based
 * checks — this is for boolean capabilities that don't map cleanly onto
 * "this tier or higher".
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
 * Enforces a numeric per-plan usage limit against a live count, e.g.
 * "you may create at most N monitors on your plan". `limitFn(plan)` must
 * resolve the plan's limit (`null` meaning unlimited); `countFn(req)`
 * must resolve the requesting user's current usage as a number.
 *
 * Wired up on monitor creation — see routes/monitor.routes.js.
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
 * actually spans, derived from the same single source of truth rather than
 * redefined here — so a new window key added to WINDOW_MS is picked up
 * automatically without a second map to keep in sync.
 */
const WINDOW_DAYS = Object.fromEntries(
  Object.entries(WINDOW_MS).map(([key, ms]) => [
    key,
    ms / (24 * 60 * 60 * 1000),
  ]),
);

/**
 * Enforces each plan's `dataRetentionDays` limit (see config/plans.js)
 * against the `window` query param on dashboard/incident analytics
 * endpoints. Previously `dataRetentionDays` was defined per plan and
 * surfaced in the usage dashboard, but nothing actually stopped a Free
 * user from requesting a 30-day chart or downtime-stats window — this
 * closes that gap.
 *
 * Must run AFTER the route's `validate(schema, "query")` middleware,
 * since it reads the already-parsed `window` value off
 * `req.validatedQuery` rather than the raw query string.
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
