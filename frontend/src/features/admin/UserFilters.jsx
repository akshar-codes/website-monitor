import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Input, Select } from "../../components/ui/Input";
import { ROLES } from "../../constants/roles";
import { PLANS } from "../../constants/plans";
import { cn } from "../../utils/cn";

const ROLE_FILTERS = [
  { label: "All roles", value: "all" },
  { label: "Admins", value: ROLES.ADMIN },
  { label: "Users", value: ROLES.USER },
];

const STATUS_FILTERS = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Suspended", value: "suspended" },
];

const PLAN_FILTERS = [
  { label: "All plans", value: "all" },
  { label: "Free", value: PLANS.FREE },
  { label: "Pro", value: PLANS.PRO },
  { label: "Enterprise", value: PLANS.UNLIMITED },
];

export default function UserFilters({
  search,
  onSearchChange,
  roleFilter,
  onRoleFilterChange,
  planFilter,
  onPlanFilterChange,
  statusFilter,
  onStatusFilterChange,
  totalCount,
  registeredFrom,
  registeredTo,
  onRegisteredFromChange,
  onRegisteredToChange,
}) {
  const [searchDraft, setSearchDraft] = useState({
    source: search,
    value: search,
  });
  const localSearch =
    searchDraft.source === search ? searchDraft.value : search;

  // Debounce the search box before it drives the server-side query — a
  // request per keystroke would otherwise hammer the list endpoint.
  useEffect(() => {
    const id = setTimeout(() => {
      if (localSearch !== search) onSearchChange(localSearch);
    }, 350);
    return () => clearTimeout(id);
  }, [localSearch, onSearchChange, search]);

  const updateSearchDraft = (value) =>
    setSearchDraft({ source: search, value });

  return (
    <div className="mb-5 flex items-center gap-3 flex-wrap">
      <div className="relative flex-1 min-w-60 max-w-sm">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
        />
        <Input
          value={localSearch}
          onChange={(e) => updateSearchDraft(e.target.value)}
          placeholder="Search by name or email…"
          className="pl-9"
        />
      </div>

      <div className="flex items-center gap-1 rounded-lg border border-border-default bg-bg-elevated p-1">
        {ROLE_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => onRoleFilterChange(f.value)}
            className={cn(
              "rounded-md px-3 py-1 text-xs font-medium transition-all",
              roleFilter === f.value
                ? "bg-bg-subtle text-white"
                : "text-text-muted hover:text-text-secondary",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1 rounded-lg border border-border-default bg-bg-elevated p-1">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => onStatusFilterChange(f.value)}
            className={cn(
              "rounded-md px-3 py-1 text-xs font-medium transition-all",
              statusFilter === f.value
                ? "bg-bg-subtle text-white"
                : "text-text-muted hover:text-text-secondary",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <Select
        value={planFilter}
        onChange={(e) => onPlanFilterChange(e.target.value)}
        className="w-36"
        aria-label="Filter by plan"
      >
        {PLAN_FILTERS.map((f) => (
          <option key={f.value} value={f.value}>
            {f.label}
          </option>
        ))}
      </Select>

      <input
        aria-label="Registered from"
        type="date"
        value={registeredFrom}
        onChange={(e) => onRegisteredFromChange(e.target.value)}
        className="rounded-md border border-border-default bg-bg-elevated px-2 py-2 text-xs text-text-secondary"
      />
      <input
        aria-label="Registered to"
        type="date"
        value={registeredTo}
        onChange={(e) => onRegisteredToChange(e.target.value)}
        className="rounded-md border border-border-default bg-bg-elevated px-2 py-2 text-xs text-text-secondary"
      />

      {totalCount != null && (
        <p className="ml-auto text-xs text-text-muted">
          {totalCount} user{totalCount !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}
