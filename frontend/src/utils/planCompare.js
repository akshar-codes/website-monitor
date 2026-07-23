/**
 * Classifies a target plan relative to the user's current plan, using the
 * `rank` field returned by GET /api/plans. Returns `undefined` when the
 * target plan is the current plan (no meaningful direction) or when either
 * plan can't be found in the catalog.
 */
export function getPlanChangeType(currentPlanId, targetPlan, plans = []) {
  if (!targetPlan || currentPlanId === targetPlan.id) return undefined;

  const current = plans.find((p) => p.id === currentPlanId);
  if (!current) return undefined;

  return targetPlan.rank > current.rank ? "upgrade" : "downgrade";
}
