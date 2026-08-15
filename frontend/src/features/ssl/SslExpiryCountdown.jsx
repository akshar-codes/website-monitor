import { cn } from "../../utils/cn";
import { daysRemainingTone } from "../../constants/ssl";

const TONE_COLORS = {
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
  neutral: "#52525b",
};

/**
 * Compact circular countdown for certificate/domain expiry. The ring
 * fill represents proximity to the warning threshold (capped at
 * `maxDays`), not an absolute percentage of the certificate's total
 * lifetime — so a long-lived cert and a 90-day cert both read the same
 * way as they approach expiry, which is the information that actually
 * matters here.
 */
export default function SslExpiryCountdown({
  daysRemaining,
  label = "Days remaining",
  maxDays = 90,
  size = 96,
}) {
  const tone = daysRemainingTone(daysRemaining);
  const color = TONE_COLORS[tone];

  const hasValue = daysRemaining != null;
  const clamped = hasValue ? Math.max(0, Math.min(daysRemaining, maxDays)) : 0;
  const percent = hasValue ? (clamped / maxDays) * 100 : 0;

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="relative flex items-center justify-center rounded-full"
        style={{
          width: size,
          height: size,
          background: hasValue
            ? `conic-gradient(${color} ${percent * 3.6}deg, #27272a ${percent * 3.6}deg)`
            : "#27272a",
        }}
      >
        <div
          className="absolute flex flex-col items-center justify-center rounded-full bg-bg-surface"
          style={{ width: size - 14, height: size - 14 }}
        >
          <span
            className={cn(
              "text-xl font-bold leading-none",
              hasValue ? "text-white" : "text-text-disabled",
            )}
          >
            {hasValue ? Math.abs(daysRemaining) : "—"}
          </span>
          <span className="mt-0.5 text-[10px] text-text-muted">
            {hasValue && daysRemaining < 0 ? "days ago" : "days left"}
          </span>
        </div>
      </div>
      <p className="text-[11px] font-medium text-text-muted">{label}</p>
    </div>
  );
}
