import React from "react";
import { cn } from "../../utils/cn";

export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 text-center",
        className,
      )}
    >
      {Icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-[#27272a] bg-[#18181b]">
          <Icon size={22} className="text-[#3f3f46]" />
        </div>
      )}
      <p className="text-sm font-medium text-[#a1a1aa]">{title}</p>
      {description && (
        <p className="mt-1 text-xs text-[#52525b] max-w-xs">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
