import { AlertTriangle, ArrowRight } from "lucide-react";
import Button from "../../components/ui/Button";
import { cn } from "../../utils/cn";

/**
 * Inline banner shown when an action was blocked because the account hit
 * a plan limit (monitor cap, interval floor, or a plan-gated feature).
 * Pass the server's own message when available — it already states the
 * specific limit that was hit (see backend/src/utils/ApiError.js#upgradeRequired).
 */
export default function LimitExceededBanner({
  message = "You've reached a limit on your current plan.",
  onUpgradeClick,
  className,
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3.5",
        className,
      )}
    >
      <AlertTriangle size={17} className="mt-0.5 shrink-0 text-amber-400" />
      <div className="flex-1">
        <p className="text-sm text-amber-200">{message}</p>
      </div>
      {onUpgradeClick && (
        <Button
          variant="secondary"
          size="sm"
          iconRight={ArrowRight}
          onClick={onUpgradeClick}
          className="shrink-0"
        >
          Upgrade
        </Button>
      )}
    </div>
  );
}
