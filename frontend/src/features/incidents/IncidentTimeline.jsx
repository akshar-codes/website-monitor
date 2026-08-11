import { CheckCircle, AlertTriangle } from "lucide-react";
import {
  SeverityBadge,
  IncidentStatusBadge,
} from "../../components/ui/SeverityBadge";
import EmptyState from "../../components/ui/EmptyState";
import { SkeletonRow } from "../../components/ui/Skeleton";
import {
  formatRelative,
  formatDuration,
  formatDateTime,
  formatDate,
  getDomain,
} from "../../utils/format";

function isSameDay(a, b) {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

function groupByDay(incidents) {
  const groups = [];
  for (const incident of incidents) {
    const last = groups[groups.length - 1];
    if (last && isSameDay(last.date, incident.startedAt)) {
      last.items.push(incident);
    } else {
      groups.push({ date: incident.startedAt, items: [incident] });
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
    <p className="sticky top-0 z-1 bg-bg-surface/95 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-text-muted backdrop-blur">
      {label}
    </p>
  );
}

function TimelineRow({ incident, onSelect }) {
  const monitor = incident.monitor;
  const isActive = incident.status !== "resolved";

  return (
    <button
      type="button"
      onClick={() => onSelect?.(incident)}
      className="flex w-full items-start gap-3 border-b border-[#1a1a1d] px-5 py-3.5 text-left transition-colors last:border-0 hover:bg-[#131315]"
    >
      <div className="mt-0.5 flex shrink-0 flex-col items-center">
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-full ${
            isActive ? "bg-red-500/10" : "bg-emerald-500/10"
          }`}
        >
          <AlertTriangle
            size={13}
            className={isActive ? "text-red-400" : "text-emerald-400"}
          />
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium text-[#e4e4e7]">
            {monitor?.name || getDomain(monitor?.url) || "Unknown monitor"}
          </p>
          <SeverityBadge severity={incident.severity} />
          <IncidentStatusBadge status={incident.status} />
        </div>
        {incident.rootCause && (
          <p className="mt-1 truncate text-xs text-text-muted">
            {incident.rootCause}
          </p>
        )}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-disabled">
          <span title={formatDateTime(incident.startedAt)}>
            Started {formatRelative(incident.startedAt)}
          </span>
          <span>
            {incident.duration
              ? `Duration ${formatDuration(incident.duration)}`
              : "Ongoing"}
          </span>
        </div>
      </div>
    </button>
  );
}

export default function IncidentTimeline({
  incidents = [],
  loading = false,
  hasActiveFilters = false,
  onSelectIncident,
}) {
  const groups = groupByDay(incidents);

  return (
    <div className="rounded-xl border border-border-subtle bg-bg-surface">
      {loading ? (
        Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
      ) : !incidents.length ? (
        <EmptyState
          icon={CheckCircle}
          title={
            hasActiveFilters
              ? "No incidents match your filters"
              : "No incidents recorded"
          }
          description={
            hasActiveFilters
              ? "Try a different search term or clear your filters."
              : "Incidents affecting your monitors will appear here in chronological order."
          }
          className="py-16"
        />
      ) : (
        <div className="max-h-[70vh] overflow-y-auto">
          {groups.map((group) => (
            <div key={group.date}>
              <DayLabel date={group.date} />
              <div>
                {group.items.map((incident) => (
                  <TimelineRow
                    key={incident.id || incident._id}
                    incident={incident}
                    onSelect={onSelectIncident}
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
