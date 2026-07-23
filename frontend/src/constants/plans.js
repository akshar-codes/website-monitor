/**
 * Subscription plan identifiers — mirrors backend/src/config/constants.js.
 * Full plan metadata (pricing, limits, feature copy) is fetched from
 * GET /api/plans rather than duplicated here, so pricing/feature changes
 * only ever require a backend deploy.
 */
export const PLANS = Object.freeze({
  FREE: "free",
  PRO: "pro",
  UNLIMITED: "unlimited",
});

export const PLAN_VALUES = Object.freeze(Object.values(PLANS));
