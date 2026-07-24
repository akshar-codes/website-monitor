import { getPlanDefinition } from "./plans.js";
import { hasUnlimitedMonitors } from "../utils/planUtils.js";

/**
 * Plan-gated feature keys. Availability is derived directly from each
 * plan's `limits` in config/plans.js rather than duplicated here as a
 * second true/false table — that keeps pricing/limit changes to a single
 * source of truth (config/plans.js) instead of two maps that can drift
 * out of sync with each other.
 */
export const FEATURES = Object.freeze({
  TEAM_ACCESS: "teamAccess",
  EXTENDED_RETENTION: "extendedRetention",
  UNLIMITED_MONITORS: "unlimitedMonitors",
  FAST_POLLING: "fastPolling",
});

const FEATURE_CHECKS = Object.freeze({
  // More than a single team seat — Pro (5) and Unlimited (null = no cap).
  [FEATURES.TEAM_ACCESS]: (plan) => {
    const definition = getPlanDefinition(plan);
    if (!definition) return false;
    const { teamMembers } = definition.limits;
    return teamMembers === null || teamMembers > 1;
  },

  // Longer than the Free tier's 7-day retention window.
  [FEATURES.EXTENDED_RETENTION]: (plan) => {
    const definition = getPlanDefinition(plan);
    return !!definition && definition.limits.dataRetentionDays > 7;
  },

  [FEATURES.UNLIMITED_MONITORS]: (plan) => hasUnlimitedMonitors(plan),

  // Faster than the Free tier's 5-minute floor.
  [FEATURES.FAST_POLLING]: (plan) => {
    const definition = getPlanDefinition(plan);
    return !!definition && definition.limits.minCheckIntervalSeconds < 300;
  },
});

/**
 * True when `plan` includes `featureKey`. An unrecognised feature key
 * resolves to `false` rather than throwing — a typo'd key fails closed.
 */
export const hasFeature = (plan, featureKey) => {
  const check = FEATURE_CHECKS[featureKey];
  return typeof check === "function" ? check(plan) : false;
};

export const getFeatureKeys = () => Object.values(FEATURES);
