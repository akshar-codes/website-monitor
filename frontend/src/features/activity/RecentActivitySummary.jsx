import ActivityIcon from "../../components/activity/ActivityIcon";
import { Skeleton } from "../../components/ui/Skeleton";
import { ACTIVITY_CATEGORY_LABELS } from "../../constants/activity";
import { formatRelative } from "../../utils/format";

export default function RecentActivitySummary({ summary, loading }) {
  if (loading || !summary) {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border-subtle bg-bg-surface p-6 lg:col-span-2">
          <Skeleton className="mb-4 h-3 w-32" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-border-subtle bg-bg-surface p-6">
          <Skeleton className="mb-4 h-3 w-24" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  const { recent = [], byCategory = [], totalLast30Days = 0 } = summary;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {/* Recent list */}
      <div className="rounded-xl border border-border-subtle bg-bg-surface p-6 lg:col-span-2">
        <p className="mb-1 text-sm font-semibold text-white">Most recent</p>
        <p className="mb-4 text-xs text-text-muted">
          Your latest actions across WebMonitor
        </p>

        {!recent.length ? (
          <p className="py-6 text-center text-sm text-text-muted">
            No recent activity
          </p>
        ) : (
          <div className="space-y-1">
            {recent.slice(0, 6).map((activity) => (
              <div
                key={activity.id || activity._id}
                className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-bg-elevated"
              >
                <ActivityIcon category={activity.category} size="sm" />
                <p className="min-w-0 flex-1 truncate text-xs text-text-secondary">
                  {activity.description}
                </p>
                <span className="shrink-0 text-[11px] text-text-disabled">
                  {formatRelative(activity.createdAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Category breakdown */}
      <div className="rounded-xl border border-border-subtle bg-bg-surface p-6">
        <p className="mb-1 text-sm font-semibold text-white">Last 30 days</p>
        <p className="mb-4 text-xs text-text-muted">
          {totalLast30Days} event{totalLast30Days !== 1 ? "s" : ""} by category
        </p>

        {!byCategory.length ? (
          <p className="py-6 text-center text-sm text-text-muted">
            No activity in this window
          </p>
        ) : (
          <div className="space-y-3">
            {byCategory.map(({ category, count }) => {
              const pct = totalLast30Days > 0 ? (count / totalLast30Days) * 100 : 0;
              return (
                <div key={category}>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-xs text-text-secondary">
                      {ACTIVITY_CATEGORY_LABELS[category] || category}
                    </span>
                    <span className="text-xs font-semibold text-white">
                      {count}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-subtle">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
