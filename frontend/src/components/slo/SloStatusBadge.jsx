import { getSloStatus } from "../../utils/sloFormat.js";

export default function SloStatusBadge({
  enabled = true,
  sli = null,
  target = 99.9,
  remainingBudgetSeconds = null,
  allowedErrorBudgetSeconds = null,
  dataCoveragePct = 100,
  alertStatus = null,
  className = "",
}) {
  const statusInfo = getSloStatus({
    enabled,
    sli,
    target,
    remainingBudgetSeconds,
    allowedErrorBudgetSeconds,
    dataCoveragePct,
    alertStatus,
  });

  const dotColor =
    {
      green: "bg-emerald-500",
      yellow: "bg-amber-500",
      red: "bg-rose-500",
      gray: "bg-slate-400",
    }[statusInfo.tone] || "bg-slate-400";

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${statusInfo.badgeClass} ${className}`}
      role="status"
      aria-label={`SLO status: ${statusInfo.label}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${dotColor}`}
        aria-hidden="true"
      />
      <span>{statusInfo.label}</span>
    </span>
  );
}
