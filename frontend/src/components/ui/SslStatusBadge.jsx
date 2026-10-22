import { ShieldCheck, ShieldAlert, XCircle, HelpCircle } from "lucide-react";
import { cn } from "../../utils/cn";
import { SSL_STATUS, SSL_STATUS_CONFIG } from "../../constants/ssl";

const TONE_CLASSES = {
  success: {
    dot: "bg-emerald-400",
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    border: "border-emerald-500/20",
  },
  warning: {
    dot: "bg-amber-400",
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    border: "border-amber-500/20",
  },
  danger: {
    dot: "bg-red-400",
    bg: "bg-red-500/10",
    text: "text-red-400",
    border: "border-red-500/20",
  },
  neutral: {
    dot: "bg-zinc-400",
    bg: "bg-zinc-500/10",
    text: "text-zinc-400",
    border: "border-zinc-500/20",
  },
};

const TONE_ICONS = {
  success: ShieldCheck,
  warning: ShieldAlert,
  danger: XCircle,
  neutral: HelpCircle,
};

/**
 * SSL certificate status badge — reusable across the SSL overview page,
 * the monitor detail SSL panel, and the monitors table. Mirrors
 * components/ui/StatusBadge.jsx's shape so the two read consistently
 * side by side.
 */
export default function SslStatusBadge({
  status,
  size = "sm",
  showIcon = true,
  showLabel = true,
  className,
}) {
  const config =
    SSL_STATUS_CONFIG[status] || SSL_STATUS_CONFIG[SSL_STATUS.PENDING];
  const tone = TONE_CLASSES[config.tone] || TONE_CLASSES.neutral;
  const Icon = TONE_ICONS[config.tone] || HelpCircle;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium",
        tone.bg,
        tone.text,
        tone.border,
        size === "sm" && "px-2 py-0.5 text-[11px]",
        size === "md" && "px-2.5 py-1 text-xs",
        size === "lg" && "px-3 py-1.5 text-sm",
        className,
      )}
    >
      {showIcon && <Icon size={size === "lg" ? 14 : 11} className="shrink-0" />}
      {showLabel && config.label}
    </span>
  );
}

/** Inline dot only — for use in tables/lists, mirrors StatusBadge's StatusDot. */
export function SslStatusDot({ status, className }) {
  const config =
    SSL_STATUS_CONFIG[status] || SSL_STATUS_CONFIG[SSL_STATUS.PENDING];
  const tone = TONE_CLASSES[config.tone] || TONE_CLASSES.neutral;
  return (
    <span
      className={cn(
        "inline-block h-2 w-2 shrink-0 rounded-full",
        tone.dot,
        className,
      )}
    />
  );
}
