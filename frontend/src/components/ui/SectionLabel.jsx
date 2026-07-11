import React from "react";
import { cn } from "../../utils/cn";

export default function SectionLabel({ children, className, action }) {
  return (
    <div className={cn("flex items-center justify-between", className)}>
      <p className="text-[11px] font-semibold uppercase tracking-widest text-text-muted">
        {children}
      </p>
      {action && <div>{action}</div>}
    </div>
  );
}
