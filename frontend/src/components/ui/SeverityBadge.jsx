import React from "react";
import { cn } from "../../utils/cn";

const SEVERITY_CONFIG = {
  critical: {
    label: "Critical",
    bg: "bg-red-500/10",
    text: "text-red-400",
    border: "border-red-500/20",
  },
  major: {
    label: "Major",
    bg: "bg-orange-500/10",
    text: "text-orange-400",
    border: "border-orange-500/20",
  },
  minor: {
    label: "Minor",
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    border: "border-amber-500/20",
  },
};

const STATUS_CONFIG = {
  ongoing: {
    label: "Ongoing",
    bg: "bg-red-500/10",
    text: "text-red-400",
    border: "border-red-500/20",
  },
  investigating: {
    label: "Investigating",
    bg: "bg-orange-500/10",
    text: "text-orange-400",
    border: "border-orange-500/20",
  },
  identified: {
    label: "Identified",
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    border: "border-amber-500/20",
  },
  resolved: {
    label: "Resolved",
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    border: "border-emerald-500/20",
  },
};

export function SeverityBadge({ severity, className }) {
  const config = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.major;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        config.bg,
        config.text,
        config.border,
        className,
      )}
    >
      {config.label}
    </span>
  );
}

export function IncidentStatusBadge({ status, className }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.ongoing;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        config.bg,
        config.text,
        config.border,
        className,
      )}
    >
      {config.label}
    </span>
  );
}
