import { cn } from "../../utils/cn";
import { CATEGORY_FILTERS, STATUS_FILTERS } from "../../constants/notifications";

export default function NotificationFilters({
  category,
  onCategoryChange,
  status,
  onStatusChange,
  unreadByCategory = {},
}) {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-3">
      <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border-default bg-bg-elevated p-1">
        {CATEGORY_FILTERS.map((f) => {
          const count = f.value === "all" ? undefined : unreadByCategory[f.value];
          return (
            <button
              key={f.value}
              onClick={() => onCategoryChange(f.value)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
                category === f.value
                  ? "bg-bg-subtle text-white"
                  : "text-text-muted hover:text-text-secondary",
              )}
            >
              {f.label}
              {!!count && (
                <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-1 rounded-lg border border-border-default bg-bg-elevated p-1">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => onStatusChange(f.value)}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-all",
              status === f.value
                ? "bg-bg-subtle text-white"
                : "text-text-muted hover:text-text-secondary",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>
    </div>
  );
}
