import { useState } from "react";
import { Calendar } from "lucide-react";
import { cn } from "../../utils/cn";
import { Input } from "./Input";
import Button from "./Button";

const PRESETS = [
  { label: "24h", value: "24h" },
  { label: "7d", value: "7d" },
  { label: "30d", value: "30d" },
];

/** Formats a Date (or date-ish value) as a "YYYY-MM-DD" string for a
 * native <input type="date">. */
function toInputDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

/**
 * Window-preset + custom-date-range picker, reusable anywhere an
 * analytics/reporting view needs to let the user pick a time range.
 */
export default function DateRangePicker({
  value,
  onChange,
  maxRangeDays,
  className,
}) {
  const isCustom = value?.mode === "custom";

  const rangeKey = `${value?.mode || ""}:${value?.window || ""}:${value?.startDate || ""}:${value?.endDate || ""}`;
  const [draft, setDraft] = useState(() => ({
    rangeKey,
    start: toInputDate(value?.startDate),
    end: toInputDate(value?.endDate),
    customOpen: isCustom,
  }));
  const syncedDraft = draft.rangeKey === rangeKey;
  const draftStart = syncedDraft ? draft.start : toInputDate(value?.startDate);
  const draftEnd = syncedDraft ? draft.end : toInputDate(value?.endDate);
  const customOpen = syncedDraft ? draft.customOpen : isCustom;
  const updateDraft = (patch) =>
    setDraft((current) => ({
      ...(current.rangeKey === rangeKey
        ? current
        : {
            rangeKey,
            start: toInputDate(value?.startDate),
            end: toInputDate(value?.endDate),
            customOpen: isCustom,
          }),
      ...patch,
      rangeKey,
    }));

  const today = toInputDate(new Date());

  const handlePreset = (window) => {
    updateDraft({ customOpen: false });
    onChange({ mode: "preset", window });
  };

  const handleApplyCustom = () => {
    if (!draftStart || !draftEnd) return;
    if (draftStart > draftEnd) return;
    onChange({ mode: "custom", startDate: draftStart, endDate: draftEnd });
  };

  const customValid = !!draftStart && !!draftEnd && draftStart <= draftEnd;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <div className="flex items-center gap-0.5 rounded-lg border border-border-default bg-bg-elevated p-0.5">
        {PRESETS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => handlePreset(p.value)}
            className={cn(
              "rounded-md px-3 py-1 text-[11px] font-medium transition-all",
              !isCustom && value?.window === p.value
                ? "bg-bg-subtle text-white"
                : "text-text-muted hover:text-text-secondary",
            )}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => updateDraft({ customOpen: !customOpen })}
          aria-pressed={isCustom}
          className={cn(
            "flex items-center gap-1 rounded-md px-3 py-1 text-[11px] font-medium transition-all",
            isCustom
              ? "bg-bg-subtle text-white"
              : "text-text-muted hover:text-text-secondary",
          )}
        >
          <Calendar size={11} /> Custom
        </button>
      </div>

      {customOpen && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border-default bg-bg-elevated p-2">
          <Input
            type="date"
            value={draftStart}
            max={draftEnd || today}
            onChange={(e) => updateDraft({ start: e.target.value })}
            aria-label="Range start date"
            className="h-7 w-36 text-xs"
          />
          <span className="text-xs text-text-muted">to</span>
          <Input
            type="date"
            value={draftEnd}
            min={draftStart}
            max={today}
            onChange={(e) => updateDraft({ end: e.target.value })}
            aria-label="Range end date"
            className="h-7 w-36 text-xs"
          />
          <Button
            type="button"
            variant="primary"
            size="xs"
            onClick={handleApplyCustom}
            disabled={!customValid}
          >
            Apply
          </Button>
        </div>
      )}

      {maxRangeDays != null && (
        <p className="text-[11px] text-text-disabled">
          Up to {maxRangeDays} day{maxRangeDays === 1 ? "" : "s"} of history on
          your plan
        </p>
      )}
    </div>
  );
}
