import { Gift, Zap, Crown } from "lucide-react";
import { cn } from "../../utils/cn";
import { PLANS } from "../../constants/plans";

const PLAN_CONFIG = {
  [PLANS.FREE]: {
    label: "Free",
    icon: Gift,
    bg: "bg-zinc-500/10",
    text: "text-zinc-400",
    border: "border-zinc-500/20",
  },
  [PLANS.PRO]: {
    label: "Pro",
    icon: Zap,
    bg: "bg-blue-500/10",
    text: "text-blue-400",
    border: "border-blue-500/20",
  },
  [PLANS.UNLIMITED]: {
    label: "Unlimited",
    icon: Crown,
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    border: "border-emerald-500/20",
  },
};

export default function PlanBadge({
  plan,
  size = "sm",
  showIcon = true,
  className,
}) {
  const config = PLAN_CONFIG[plan] || PLAN_CONFIG[PLANS.FREE];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium",
        config.bg,
        config.text,
        config.border,
        size === "sm" && "px-2 py-0.5 text-[11px]",
        size === "md" && "px-2.5 py-1 text-xs",
        size === "lg" && "px-3 py-1.5 text-sm",
        className,
      )}
    >
      {showIcon && (
        <Icon size={size === "lg" ? 13 : 11} className="shrink-0" />
      )}
      {config.label}
    </span>
  );
}
