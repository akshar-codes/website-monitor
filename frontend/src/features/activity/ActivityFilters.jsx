import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Input, Select } from "../../components/ui/Input";
import {
  ACTIVITY_CATEGORY_OPTIONS,
  ACTIVITY_WINDOW_OPTIONS,
} from "../../constants/activity";
import { cn } from "../../utils/cn";

export default function ActivityFilters({
  search,
  onSearchChange,
  categoryFilter,
  onCategoryFilterChange,
  windowFilter,
  onWindowFilterChange,
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

  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  return (
    <div className="mb-5 flex flex-wrap items-center gap-3">
      <div className="relative min-w-60 max-w-sm flex-1">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
        />
        <Input
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          placeholder="Search activity…"
          className="pl-9"
        />
      </div>

      <Select
        value={categoryFilter}
        onChange={(e) => onCategoryFilterChange(e.target.value)}
        className="w-44"
        aria-label="Filter by category"
      >
        <option value="all">All categories</option>
        {ACTIVITY_CATEGORY_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </Select>

      <div className="flex items-center gap-1 rounded-lg border border-border-default bg-bg-elevated p-1">
        {ACTIVITY_WINDOW_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onWindowFilterChange(opt.value)}
            className={cn(
              "rounded-md px-3 py-1 text-xs font-medium transition-all",
              windowFilter === opt.value
                ? "bg-bg-subtle text-white"
                : "text-text-muted hover:text-text-secondary",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {totalCount != null && (
        <p className="ml-auto text-xs text-text-muted">
          {totalCount} event{totalCount !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}
