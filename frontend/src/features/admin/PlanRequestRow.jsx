import { Check, X } from "lucide-react";
import PlanBadge from "../../components/ui/PlanBadge";
import Button from "../../components/ui/Button";
import { formatRelative } from "../../utils/format";
import { cn } from "../../utils/cn";

const STATUS_CONFIG = {
  pending: {
    label: "Pending",
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    border: "border-amber-500/20",
  },
  approved: {
    label: "Approved",
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    border: "border-emerald-500/20",
  },
  rejected: {
    label: "Rejected",
    bg: "bg-red-500/10",
    text: "text-red-400",
    border: "border-red-500/20",
  },
};

function RequestStatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        config.bg,
        config.text,
        config.border,
      )}
    >
      {config.label}
    </span>
  );
}

export default function PlanRequestRow({
  request,
  onApprove,
  onReject,
  approving = false,
  rejecting = false,
}) {
  const isPending = request.status === "pending";
  const busy = approving || rejecting;

  return (
    <div className="grid grid-cols-[1fr_110px_130px_130px_100px_180px] items-center gap-3 border-b border-[#1a1a1d] px-5 py-4 transition-colors hover:bg-[#131315] last:border-0">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-white">
          {request.user?.name || "Unknown user"}
        </p>
        <p className="truncate text-xs text-text-muted">
          {request.user?.email || "—"}
        </p>
      </div>

      <div>
        <PlanBadge plan={request.currentPlan} size="sm" />
      </div>

      <div className="flex flex-col items-start gap-1.5">
        <PlanBadge plan={request.requestedPlan} size="sm" />
        {request.grantedPlan && request.grantedPlan !== request.requestedPlan && (
          <div className="flex items-center gap-1 text-[10px] text-text-muted">
            <span className="text-[10px]">↳ Granted</span>
            <PlanBadge plan={request.grantedPlan} size="sm" />
          </div>
        )}
      </div>

      <div>
        <p className="text-xs text-text-secondary">
          {formatRelative(request.createdAt)}
        </p>
      </div>

      <div>
        <RequestStatusBadge status={request.status} />
      </div>

      <div className="flex items-center justify-end gap-2">
        {isPending ? (
          <>
            <Button
              variant="danger"
              size="xs"
              icon={X}
              onClick={onReject}
              disabled={busy}
              loading={rejecting}
            >
              Reject
            </Button>
            <Button
              variant="primary"
              size="xs"
              icon={Check}
              onClick={onApprove}
              disabled={busy}
              loading={approving}
            >
              Approve
            </Button>
          </>
        ) : (
          <p className="text-right text-[11px] text-text-disabled">
            {request.reviewedBy?.name
              ? `Reviewed by ${request.reviewedBy.name}`
              : "Reviewed"}
          </p>
        )}
      </div>
    </div>
  );
}
