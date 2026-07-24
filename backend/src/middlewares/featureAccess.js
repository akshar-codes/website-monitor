import ApiError from "../utils/ApiError.js";
import { hasFeature } from "../config/features.js";

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
 * Not currently wired to monitor creation: Monitor documents in this
 * codebase are org-wide/shared rather than owned by an individual user
 * (see utils/planUtils.js's note on `maxMonitors`), so there is no
 * per-user monitor count to check yet. Once monitors — or any other
 * resource — gain an `owner` field, enforcing that resource's plan limit
 * at creation time is a single call to this factory, no new logic needed:
 *
 *   router.post(
 *     "/",
 *     requireWithinLimit({
 *       limitFn: getMonitorLimit,
 *       countFn: (req) => Monitor.countDocuments({ owner: req.user.id }),
 *       resourceName: "monitor",
 *     }),
 *     ...
 *   );
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
