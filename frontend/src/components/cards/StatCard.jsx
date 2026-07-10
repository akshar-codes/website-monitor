import React from "react";
import { cn } from "../../utils/cn";
import { Skeleton } from "../ui/Skeleton";

export default function StatCard({
  label,
  value,
  description,
  icon: Icon,
  iconColor = "text-emerald-400",
  iconBg = "bg-emerald-500/10",
  trend,
  loading = false,
  accent,
  className,
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-[#1f1f23] bg-[#111113] p-5 transition-all duration-150 hover:border-[#27272a]",
        className,
      )}
    >
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[#52525b]">
              {label}
            </p>
            {Icon && (
              <div
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                  iconBg,
                )}
              >
                <Icon size={15} className={iconColor} />
              </div>
            )}
          </div>

          <div className="mt-2.5">
            <p
              className={cn(
                "text-[28px] font-bold leading-none tracking-tight",
                accent || "text-white",
              )}
            >
              {value ?? "—"}
            </p>
          </div>

          {(description || trend) && (
            <div className="mt-2 flex items-center gap-2">
              {description && (
                <p className="text-xs text-[#52525b]">{description}</p>
              )}
              {trend && (
                <span
                  className={cn(
                    "text-[11px] font-medium",
                    trend.direction === "up"
                      ? "text-emerald-400"
                      : "text-red-400",
                  )}
                >
                  {trend.direction === "up" ? "↑" : "↓"} {trend.value}
                </span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
