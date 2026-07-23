import { Sparkles, ArrowRight } from "lucide-react";
import { cn } from "../../utils/cn";
import Button from "../../components/ui/Button";
import { PLANS } from "../../constants/plans";

/**
 * Nudges a Free-plan user toward upgrading. Renders nothing once the user
 * is on a paid plan. `variant="banner"` renders a full-width card (Billing
 * page); `variant="compact"` renders a small inline nudge (e.g. the
 * sidebar footer).
 */
export default function UpgradePrompt({
  plan,
  onUpgradeClick,
  variant = "banner",
  className,
}) {
  if (plan && plan !== PLANS.FREE) return null;

  if (variant === "compact") {
    return (
      <button
        onClick={onUpgradeClick}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs font-medium text-emerald-400 transition-colors hover:bg-emerald-500/10",
          className,
        )}
      >
        <Sparkles size={13} className="shrink-0" />
        <span className="truncate">Upgrade plan</span>
        <ArrowRight size={12} className="ml-auto shrink-0" />
      </button>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-xl border border-emerald-500/15 bg-emerald-500/5 px-5 py-4",
        className,
      )}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
        <Sparkles size={18} className="text-emerald-400" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-white">
          You&apos;re on the Free plan
        </p>
        <p className="text-xs text-text-muted">
          Upgrade to Pro or Unlimited for more monitors, faster checks, and
          longer data retention.
        </p>
      </div>
      <Button
        variant="primary"
        size="sm"
        iconRight={ArrowRight}
        onClick={onUpgradeClick}
      >
        View plans
      </Button>
    </div>
  );
}
