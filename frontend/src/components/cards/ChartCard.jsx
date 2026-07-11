import { useState } from "react";
import { cn } from "../../utils/cn";

function WindowSelector({ options, value, onChange }) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-border-default bg-bg-elevated p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "rounded-md px-2.5 py-1 text-[11px] font-medium transition-all",
            value === opt.value
              ? "bg-bg-subtle text-white"
              : "text-text-muted hover:text-text-secondary",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export default function ChartCard({
  title,
  subtitle,
  children,
  loading = false,
  windows,
  window: currentWindow,
  onWindowChange,
  action,
  className,
  height = 280,
}) {
  const [skeletonHeights] = useState(() =>
    Array.from({ length: 12 }, () => 20 + Math.random() * 70),
  );
  return (
    <div
      className={cn(
        "rounded-xl border border-border-subtle bg-bg-surface p-6",
        className,
      )}
    >
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-white">{title}</p>
          {subtitle && (
            <p className="mt-0.5 text-xs text-text-muted">{subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {windows && onWindowChange && (
            <WindowSelector
              options={windows}
              value={currentWindow}
              onChange={onWindowChange}
            />
          )}
          {action}
        </div>
      </div>

      {loading ? (
        <div style={{ height }} className="flex items-end gap-2 pb-4">
          {skeletonHeights.map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-sm bg-bg-overlay"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      ) : (
        <div style={{ height }}>{children}</div>
      )}
    </div>
  );
}
