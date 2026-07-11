import React from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight } from "lucide-react";
import {
  SeverityBadge,
  IncidentStatusBadge,
} from "../../components/ui/SeverityBadge";
import { formatRelative, formatDuration, getDomain } from "../../utils/format";
import { Skeleton } from "../../components/ui/Skeleton";
import EmptyState from "../../components/ui/EmptyState";
import { CheckCircle } from "lucide-react";

function IncidentRow({ incident }) {
  const monitor = incident.monitor;
  const duration = incident.duration
    ? formatDuration(incident.duration)
    : formatRelative(incident.startedAt);

  return (
    <div className="flex items-start gap-3 px-5 py-4 transition-colors hover:bg-[#131315] border-b border-[#1a1a1d] last:border-0">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-500/10">
        <AlertTriangle size={15} className="text-red-400" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-white truncate">
            {monitor?.name || getDomain(monitor?.url)}
          </p>
          <SeverityBadge severity={incident.severity} />
          <IncidentStatusBadge status={incident.status} />
        </div>
        <p className="mt-0.5 text-xs text-text-muted">
          Started {formatRelative(incident.startedAt)} · {duration}
        </p>
      </div>
    </div>
  );
}

export default function ActiveIncidents({
  incidents = [],
  count = 0,
  loading = false,
}) {
  return (
    <div className="rounded-xl border border-border-subtle bg-bg-surface">
      <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-white">Active Incidents</p>
          <p className="text-xs text-text-muted">
            {count > 0 ? `${count} unresolved` : "All systems operational"}
          </p>
        </div>
        <Link
          to="/insights"
          className="flex items-center gap-1 text-[11px] font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
        >
          View all <ArrowRight size={12} />
        </Link>
      </div>

      <div>
        {loading ? (
          <div className="space-y-0">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 border-b border-[#1a1a1d] px-5 py-4 last:border-0"
              >
                <Skeleton className="h-8 w-8 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-36" />
                  <Skeleton className="h-2.5 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : !incidents.length ? (
          <EmptyState
            icon={CheckCircle}
            title="No active incidents"
            description="All monitors are healthy."
            className="py-10"
          />
        ) : (
          incidents.map((incident) => (
            <IncidentRow
              key={incident.id || incident._id}
              incident={incident}
            />
          ))
        )}
      </div>
    </div>
  );
}
