import { cn } from "../../utils/cn";

/**
 * Compact "X used / Y limit" indicator with a progress bar, for use next
 * to actions like "Add Monitor". Renders a plain count (no bar) once the
 * plan has no monitor cap.
 */
export default function UsageIndicator({ usage, loading = false, className }) {
  if (loading || !usage) {
    return (
      <div
        className={cn(
          "h-8 w-36 animate-pulse rounded-lg bg-bg-overlay",
          className,
        )}
      />
    );
  }

  const { used, limit, unlimited, percentUsed, atLimit } = usage.monitors;

  return (
    <div className={cn("min-w-32", className)}>
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="font-medium text-text-secondary">
          {unlimited ? `${used} monitors` : `${used} / ${limit} monitors`}
        </span>
        {!unlimited && (
          <span
            className={cn(
              "font-semibold",
              atLimit
                ? "text-red-400"
                : percentUsed >= 80
                  ? "text-amber-400"
                  : "text-emerald-400",
            )}
          >
            {percentUsed}%
          </span>
        )}
      </div>
      {!unlimited && (
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-bg-subtle">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              atLimit
                ? "bg-red-500"
                : percentUsed >= 80
                  ? "bg-amber-500"
                  : "bg-emerald-500",
            )}
            style={{ width: `${percentUsed}%` }}
          />
        </div>
      )}
    </div>
  );
}
