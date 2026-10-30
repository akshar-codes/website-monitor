const PLAN_LABELS = Object.freeze({
  free: "Free",
  pro: "Pro",
  unlimited: "Enterprise",
});

export function formatPlanName(plan) {
  if (!plan) return "Free";
  const key = String(plan).toLowerCase();
  return PLAN_LABELS[key] || String(plan);
}
