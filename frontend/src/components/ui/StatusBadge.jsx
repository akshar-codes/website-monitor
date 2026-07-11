import { cn } from "../../utils/cn";

const STATUS_CONFIG = {
  up: {
    label: "Online",
    dot: "bg-emerald-400",
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    border: "border-emerald-500/20",
    pulse: true,
  },
  down: {
    label: "Offline",
    dot: "bg-red-400",
    bg: "bg-red-500/10",
    text: "text-red-400",
    border: "border-red-500/20",
    pulse: false,
  },
  degraded: {
    label: "Degraded",
    dot: "bg-amber-400",
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    border: "border-amber-500/20",
    pulse: false,
  },
  unknown: {
    label: "Unknown",
    dot: "bg-zinc-400",
    bg: "bg-zinc-500/10",
    text: "text-zinc-400",
    border: "border-zinc-500/20",
    pulse: false,
  },
  paused: {
    label: "Paused",
    dot: "bg-zinc-400",
    bg: "bg-zinc-500/10",
    text: "text-zinc-400",
    border: "border-zinc-500/20",
    pulse: false,
  },
};

export default function StatusBadge({
  status,
  size = "sm",
  showLabel = true,
  className,
}) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.unknown;

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
      <span
        className={cn(
          "inline-block shrink-0 rounded-full",
          config.dot,
          config.pulse && "animate-pulse-subtle",
          size === "sm" && "h-1.5 w-1.5",
          size === "md" && "h-2 w-2",
          size === "lg" && "h-2.5 w-2.5",
        )}
      />
      {showLabel && config.label}
    </span>
  );
}

/**
 * Inline dot only — for use in tables etc.
 */
export function StatusDot({ status, className }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.unknown;
  return (
    <span
      className={cn(
        "inline-block h-2 w-2 rounded-full shrink-0",
        config.dot,
        status === "up" && "animate-pulse-subtle",
        className,
      )}
    />
  );
}
