import { History } from "lucide-react";
import ActivityIcon from "../../components/activity/ActivityIcon";
import EmptyState from "../../components/ui/EmptyState";
import { SkeletonRow } from "../../components/ui/Skeleton";
import { ACTIVITY_CATEGORY_LABELS } from "../../constants/activity";
import { formatRelative, formatDateTime, formatDate } from "../../utils/format";

function isSameDay(a, b) {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

function groupByDay(activities) {
  const groups = [];
  for (const activity of activities) {
    const last = groups[groups.length - 1];
    if (last && isSameDay(last.date, activity.createdAt)) {
      last.items.push(activity);
    } else {
      groups.push({ date: activity.createdAt, items: [activity] });
    }
  }
  return groups;
}

function DayLabel({ date }) {
  const today = new Date();
  const isToday = isSameDay(date, today);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = isSameDay(date, yesterday);

  const label = isToday
    ? "Today"
    : isYesterday
      ? "Yesterday"
      : formatDate(date);

  return (
    <p className="sticky top-0 z-[1] bg-bg-surface/95 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-text-muted backdrop-blur">
      {label}
    </p>
  );
}

function ActivityRow({ activity }) {
  return (
    <div className="flex items-start gap-3 border-b border-[#1a1a1d] px-5 py-3.5 transition-colors last:border-0 hover:bg-[#131315]">
      <ActivityIcon category={activity.category} size="sm" className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-[#e4e4e7]">{activity.description}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="rounded-full border border-border-default bg-bg-elevated px-2 py-0.5 text-[10px] font-medium text-text-muted">
            {ACTIVITY_CATEGORY_LABELS[activity.category] || activity.category}
          </span>
          <span
            className="text-[11px] text-text-disabled"
            title={formatDateTime(activity.createdAt)}
          >
            {formatRelative(activity.createdAt)}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function ActivityTimeline({
  activities = [],
  loading = false,
  hasActiveFilters = false,
}) {
  const groups = groupByDay(activities);

  return (
    <div className="rounded-xl border border-border-subtle bg-bg-surface">
      {loading ? (
        Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
      ) : !activities.length ? (
        <EmptyState
          icon={History}
          title={
            hasActiveFilters
              ? "No activity matches your filters"
              : "No activity yet"
          }
          description={
            hasActiveFilters
              ? "Try a different search term or clear your filters."
              : "Actions you take across WebMonitor — sign-ins, monitor changes, incident updates, and more — will show up here."
          }
          className="py-16"
        />
      ) : (
        <div className="max-h-[70vh] overflow-y-auto">
          {groups.map((group) => (
            <div key={group.date}>
              <DayLabel date={group.date} />
              <div>
                {group.items.map((activity) => (
                  <ActivityRow
                    key={activity.id || activity._id}
                    activity={activity}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
