import { Clock } from "lucide-react";
import { cn } from "../../utils/cn";

/**
 * Shown on the Billing page and inside PlanChangeModal whenever the
 * caller has a pending manual upgrade request — explains why plan actions
 * are temporarily disabled (see pages/Billing.jsx).
 */
export default function PendingUpgradeBanner({ planName, className }) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3.5",
        className,
      )}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
        <Clock size={17} className="text-amber-400" />
      </div>
      <div>
        <p className="text-sm font-medium text-amber-200">
          Upgrade request pending
        </p>
        <p className="text-xs text-amber-200/80">
          Your request to upgrade to the {planName} plan is awaiting admin
          approval. Plan changes are disabled until it&apos;s reviewed.
        </p>
      </div>
    </div>
  );
}
