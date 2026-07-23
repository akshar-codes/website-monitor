import { getPlanDefinition } from "../config/plans.js";

/** Numeric rank for comparing plans; -1 for an unrecognised plan id. */
export const getPlanRank = (plan) => getPlanDefinition(plan)?.rank ?? -1;

/**
 * Compares two plans by rank. Positive when `planA` outranks `planB`,
 * negative when it's lower, zero when they're the same tier.
 */
export const comparePlans = (planA, planB) =>
  getPlanRank(planA) - getPlanRank(planB);

export const isUpgrade = (fromPlan, toPlan) =>
  comparePlans(toPlan, fromPlan) > 0;

export const isDowngrade = (fromPlan, toPlan) =>
  comparePlans(toPlan, fromPlan) < 0;

/**
 * Classifies a plan transition — used for response messaging, logging, and
 * (eventually) deciding whether a payment step is required before the
 * change takes effect.
 */
export const getChangeType = (fromPlan, toPlan) => {
  if (fromPlan === toPlan) return "same";
  return isUpgrade(fromPlan, toPlan) ? "upgrade" : "downgrade";
};

/** `null` return means the plan has no monitor cap. */
export const getMonitorLimit = (plan) =>
  getPlanDefinition(plan)?.limits.maxMonitors ?? 0;

export const hasUnlimitedMonitors = (plan) => getMonitorLimit(plan) === null;

/** Fastest interval (in seconds) a plan is permitted to poll at. */
export const getMinCheckInterval = (plan) =>
  getPlanDefinition(plan)?.limits.minCheckIntervalSeconds ?? Infinity;

/**
 * True when `intervalSeconds` respects the plan's minimum check interval —
 * a smaller interval means more frequent polling, so the requested
 * interval must be >= the plan's floor.
 *
 * Not currently wired into monitor creation: Monitor documents in this
 * codebase are global (no `owner` field), so there is no per-user monitor
 * set to enforce a limit against yet. This helper is exported so that
 * check is a one-line addition once monitors become user-scoped, rather
 * than a redesign of the plan system.
 */
export const isIntervalAllowedForPlan = (plan, intervalSeconds) =>
  intervalSeconds >= getMinCheckInterval(plan);
