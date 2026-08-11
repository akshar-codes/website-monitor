import { AlertTriangle, Clock, ArrowRight } from "lucide-react";
import {
  SeverityBadge,
  IncidentStatusBadge,
} from "../../components/ui/SeverityBadge";
import {
  formatRelative,
  formatDuration,
  formatDateTime,
  getDomain,
} from "../../utils/format";

export default function IncidentCard({ incident, onClick }) {
  const monitor = incident.monitor;
  const isActive = incident.status !== "resolved";

  return (
    <button
      type="button"
      onClick={() => onClick?.(incident)}
      className="group flex w-full flex-col gap-3 rounded-xl border border-border-subtle bg-bg-surface p-5 text-left transition-all duration-150 hover:border-border-default hover:bg-[#131315]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
              isActive ? "bg-red-500/10" : "bg-emerald-500/10"
            }`}
          >
            <AlertTriangle
              size={16}
              className={isActive ? "text-red-400" : "text-emerald-400"}
            />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">
              {monitor?.name || getDomain(monitor?.url) || "Unknown monitor"}
            </p>
            <p className="truncate text-xs text-text-muted">
              {monitor?.url || "—"}
            </p>
          </div>
        </div>
        <ArrowRight
          size={14}
          className="mt-1 shrink-0 text-text-disabled transition-transform group-hover:translate-x-0.5 group-hover:text-text-muted"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge severity={incident.severity} />
        <IncidentStatusBadge status={incident.status} />
      </div>

      {incident.rootCause && (
        <p className="line-clamp-2 text-xs text-text-secondary">
          {incident.rootCause}
        </p>
      )}

      <div className="flex items-center justify-between border-t border-border-subtle pt-3 text-[11px] text-text-muted">
        <span
          className="flex items-center gap-1"
          title={formatDateTime(incident.startedAt)}
        >
          <Clock size={11} />
          Started {formatRelative(incident.startedAt)}
        </span>
        <span>
          {incident.duration ? formatDuration(incident.duration) : "Ongoing"}
        </span>
      </div>
    </button>
  );
}
