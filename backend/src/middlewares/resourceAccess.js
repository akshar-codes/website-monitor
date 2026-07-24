import { isAuthenticated } from "./authenticate.js";
import { authorize } from "./authorize.js";
import { requirePermission, requireAnyPermission } from "./permission.js";
import { requirePlan, requireMinPlan } from "./planAuthorization.js";
import { requireFeature } from "./featureAccess.js";
import { requireOwnership } from "./ownership.js";

/**
 * Declarative access-control composer. Chains the independently reusable
 * middlewares below (auth → role → permission → plan → feature →
 * ownership) in a fixed, sensible order so a route can describe *what* it
 * requires without re-deriving *how* the checks compose. Every stage
 * below is still fully usable on its own for routes with simpler needs —
 * this is a convenience layer on top of them, not a replacement.
 *
 * Usage:
 *   router.post(
 *     "/",
 *     ...authorizeAccess({ permissions: ["monitor:create"] }),
 *     validate(createMonitorSchema, "body"),
 *     createMonitor,
 *   );
 *
 *   router.get(
 *     "/:id",
 *     ...authorizeAccess({
 *       permissions: ["monitor:read"],
 *       ownership: { Model: SomeUserOwnedModel, ownerField: "owner" },
 *     }),
 *     getSomeUserOwnedResource,
 *   );
 *
 * @param {object} rules
 * @param {string[]} [rules.roles] — passed to middlewares/authorize.js
 * @param {string[]} [rules.permissions] — ALL required (AND)
 * @param {string[]} [rules.anyPermission] — at least ONE required (OR)
 * @param {string[]} [rules.plans] — exact plan match, any of these
 * @param {string} [rules.minPlan] — minimum plan rank (see config/plans.js)
 * @param {string} [rules.feature] — plan-gated feature key (see config/features.js)
 * @param {{ Model: import("mongoose").Model } & object} [rules.ownership] — passed to middlewares/ownership.js
 * @returns {Function[]} an Express middleware chain — spread it into a route definition
 */
export const authorizeAccess = (rules = {}) => {
  const chain = [isAuthenticated];

  if (rules.roles?.length) {
    chain.push(authorize(...rules.roles));
  }

  if (rules.permissions?.length) {
    chain.push(requirePermission(...rules.permissions));
  }

  if (rules.anyPermission?.length) {
    chain.push(requireAnyPermission(...rules.anyPermission));
  }

  if (rules.plans?.length) {
    chain.push(requirePlan(...rules.plans));
  }

  if (rules.minPlan) {
    chain.push(requireMinPlan(rules.minPlan));
  }

  if (rules.feature) {
    chain.push(requireFeature(rules.feature));
  }

  if (rules.ownership) {
    const { Model, ...options } = rules.ownership;
    chain.push(requireOwnership(Model, options));
  }

  return chain;
};
