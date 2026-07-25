import Monitor from "../models/Monitor.js";
import { getPlanDefinition } from "../config/plans.js";
import { hasFeature, FEATURES } from "../config/features.js";

/**
 * Computes the requesting user's current usage against their plan's
 * limits. This is the single source powering the usage dashboard, the
 * remaining-monitor-count indicator, and every upgrade prompt on the
 * frontend.
 *
 * Deliberately reads exclusively from config/plans.js (the existing,
 * already-centralized limit source) — no limit number is ever redefined
 * here. Changing a plan's limits only ever requires editing
 * config/plans.js; this module, the enforcement middleware
 * (middlewares/featureAccess.js), and the frontend all update
 * automatically.
 */
export const getUsageForUser = async (user) => {
  const ownerId = user.id || user._id;
  const plan = user.plan;
  const definition = getPlanDefinition(plan);

  const monitorCount = await Monitor.countDocuments({ owner: ownerId });
  const monitorLimit = definition.limits.maxMonitors; // null = unlimited

  const unlimited = monitorLimit == null;
  const remaining = unlimited
    ? null
    : Math.max(0, monitorLimit - monitorCount);
  const percentUsed = unlimited
    ? 0
    : monitorLimit === 0
      ? 100
      : Math.min(100, Math.round((monitorCount / monitorLimit) * 100));

  return {
    plan,
    planName: definition.name,
    monitors: {
      used: monitorCount,
      limit: monitorLimit,
      remaining,
      unlimited,
      percentUsed,
      atLimit: !unlimited && monitorCount >= monitorLimit,
    },
    interval: {
      minSeconds: definition.limits.minCheckIntervalSeconds,
    },
    retention: {
      days: definition.limits.dataRetentionDays,
    },
    team: {
      limit: definition.limits.teamMembers,
      unlimited: definition.limits.teamMembers == null,
    },
    features: {
      [FEATURES.TEAM_ACCESS]: hasFeature(plan, FEATURES.TEAM_ACCESS),
      [FEATURES.EXTENDED_RETENTION]: hasFeature(
        plan,
        FEATURES.EXTENDED_RETENTION,
      ),
      [FEATURES.UNLIMITED_MONITORS]: hasFeature(
        plan,
        FEATURES.UNLIMITED_MONITORS,
      ),
      [FEATURES.FAST_POLLING]: hasFeature(plan, FEATURES.FAST_POLLING),
    },
  };
};
