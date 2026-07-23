import { Check } from "lucide-react";
import { cn } from "../../utils/cn";
import Button from "../../components/ui/Button";

/**
 * `plan` is a plan-catalog entry: { id, name, tagline, rank, price, limits, features }
 */
export default function PlanCard({
  plan,
  isCurrent = false,
  changeType, // "upgrade" | "downgrade" | undefined
  onSelect,
  loading = false,
  disabled = false,
}) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border bg-bg-surface p-6 transition-all",
        isCurrent
          ? "border-emerald-500/40 shadow-[0_0_0_1px_rgba(16,185,129,0.2)]"
          : "border-border-subtle hover:border-border-default",
      )}
    >
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-white">{plan.name}</p>
          {isCurrent && (
            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
              Current
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-text-muted">{plan.tagline}</p>
      </div>

      <div className="mb-5">
        <span className="text-[28px] font-bold leading-none tracking-tight text-white">
          ${plan.price.monthly}
        </span>
        <span className="text-xs text-text-muted"> / month</span>
      </div>

      <ul className="mb-6 flex-1 space-y-2.5">
        {plan.features.map((feature) => (
          <li
            key={feature}
            className="flex items-start gap-2 text-xs text-text-secondary"
          >
            <Check size={13} className="mt-0.5 shrink-0 text-emerald-400" />
            {feature}
          </li>
        ))}
      </ul>

      <Button
        variant={
          isCurrent
            ? "secondary"
            : changeType === "downgrade"
              ? "outline"
              : "primary"
        }
        size="md"
        className="w-full"
        disabled={isCurrent || disabled}
        loading={loading}
        onClick={() => onSelect?.(plan.id)}
      >
        {isCurrent
          ? "Current plan"
          : changeType === "downgrade"
            ? `Downgrade to ${plan.name}`
            : `Upgrade to ${plan.name}`}
      </Button>
    </div>
  );
}
