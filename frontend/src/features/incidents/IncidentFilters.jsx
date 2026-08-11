import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "../../components/ui/Input";
import DateRangePicker from "../../components/ui/DateRangePicker";
import { cn } from "../../utils/cn";

const SEVERITY_FILTERS = [
  { label: "All severities", value: "all" },
  { label: "Critical", value: "critical" },
  { label: "Major", value: "major" },
  { label: "Minor", value: "minor" },
];

const STATUS_FILTERS = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Ongoing", value: "ongoing" },
  { label: "Investigating", value: "investigating" },
  { label: "Identified", value: "identified" },
  { label: "Resolved", value: "resolved" },
];

export default function IncidentFilters({
  search,
  onSearchChange,
  severityFilter,
  onSeverityFilterChange,
  statusFilter,
  onStatusFilterChange,
  dateRange,
  onDateRangeChange,
  retentionDays,
  totalCount,
}) {
  const [localSearch, setLocalSearch] = useState(search);

  // Debounce the search box before it drives the server-side query — a
  // request per keystroke would otherwise hammer the list endpoint.
  useEffect(() => {
    const id = setTimeout(() => {
      if (localSearch !== search) onSearchChange(localSearch);
    }, 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localSearch]);

  // Keep the input in sync if the parent resets search externally.
  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  return (
    <div className="mb-5 space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-60 max-w-sm flex-1">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <Input
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Search by monitor, URL, or root cause…"
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border-default bg-bg-elevated p-1">
          {SEVERITY_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => onSeverityFilterChange(f.value)}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-all",
                severityFilter === f.value
                  ? "bg-bg-subtle text-white"
                  : "text-text-muted hover:text-text-secondary",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {totalCount != null && (
          <p className="ml-auto text-xs text-text-muted">
            {totalCount} incident{totalCount !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border-default bg-bg-elevated p-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => onStatusFilterChange(f.value)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-all",
                statusFilter === f.value
                  ? "bg-bg-subtle text-white"
                  : "text-text-muted hover:text-text-secondary",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <DateRangePicker
          value={dateRange}
          onChange={onDateRangeChange}
          maxRangeDays={retentionDays}
        />
      </div>
    </div>
  );
}
