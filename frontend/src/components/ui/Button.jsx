import React from "react";
import { cn } from "../../utils/cn";
import { Loader2 } from "lucide-react";

const VARIANTS = {
  primary:
    "bg-emerald-500 text-white hover:bg-emerald-600 shadow-[0_0_0_1px_rgba(16,185,129,0.3)]",
  secondary:
    "bg-bg-overlay text-text-secondary border border-border-default hover:bg-bg-subtle hover:text-white",
  ghost: "text-[#71717a] hover:bg-bg-overlay hover:text-white",
  danger:
    "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 hover:text-red-300",
  outline:
    "border border-border-default bg-transparent text-text-secondary hover:bg-bg-overlay hover:text-white",
};

const SIZES = {
  xs: "h-7 px-2.5 text-xs gap-1.5",
  sm: "h-8 px-3 text-xs gap-2",
  md: "h-9 px-4 text-sm gap-2",
  lg: "h-10 px-5 text-sm gap-2",
};

export default function Button({
  children,
  variant = "secondary",
  size = "md",
  loading = false,
  disabled = false,
  icon: Icon,
  iconRight: IconRight,
  className,
  onClick,
  type = "button",
  ...props
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center rounded-lg font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 disabled:pointer-events-none disabled:opacity-40",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {loading ? (
        <Loader2 size={14} className="animate-spin" />
      ) : Icon ? (
        <Icon
          size={size === "xs" || size === "sm" ? 13 : 15}
          className="shrink-0"
        />
      ) : null}
      {children}
      {IconRight && !loading && (
        <IconRight
          size={size === "xs" || size === "sm" ? 13 : 15}
          className="shrink-0"
        />
      )}
    </button>
  );
}
