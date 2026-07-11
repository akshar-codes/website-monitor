import React from "react";

export default function ChartTooltip({
  active,
  payload,
  label,
  formatter,
  labelFormatter,
}) {
  if (!active || !payload?.length) return null;

  const displayLabel = labelFormatter ? labelFormatter(label) : label;

  return (
    <div className="rounded-xl border border-border-default bg-bg-elevated px-3 py-2.5 shadow-xl">
      {displayLabel && (
        <p className="mb-2 text-[11px] font-semibold text-[#71717a]">
          {displayLabel}
        </p>
      )}
      <div className="space-y-1.5">
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center gap-2">
            <span
              className="inline-block h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-[11px] text-text-secondary">{entry.name}</span>
            <span className="ml-auto pl-4 text-[11px] font-semibold text-white">
              {formatter ? formatter(entry.value, entry.name) : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
