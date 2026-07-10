import React from "react";
import { AlertTriangle, CheckCircle } from "lucide-react";
import {
  SeverityBadge,
  IncidentStatusBadge,
} from "../../components/ui/SeverityBadge";
import { formatRelative, formatDuration, getDomain } from "../../utils/format";
import { Skeleton } from "../../components/ui/Skeleton";
import EmptyState from "../../components/ui/EmptyState";

const COLUMN_HEADERS = [
  "Monitor",
  "Severity",
  "Status",
  "Started",
  "Duration",
  "Cause",
];

function IncidentTableRow({ incident }) {
  const monitor = incident.monitor;
  return (
    <div className="grid grid-cols-[1fr_90px_110px_130px_100px_1fr] items-center gap-3 border-b border-[#1a1a1d] px-5 py-4 last:border-0 hover:bg-[#131315] transition-colors">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-white">
          {monitor?.name || getDomain(monitor?.url) || "Unknown"}
        </p>
        <p className="truncate text-xs text-[#52525b]">{monitor?.url || "—"}</p>
      </div>
      <div>
        <SeverityBadge severity={incident.severity} />
      </div>
      <div>
        <IncidentStatusBadge status={incident.status} />
      </div>
      <div>
        <p className="text-xs text-[#a1a1aa]">
          {formatRelative(incident.startedAt)}
        </p>
      </div>
      <div>
        <p className="text-xs text-[#a1a1aa]">
          {incident.duration ? formatDuration(incident.duration) : "Ongoing"}
        </p>
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs text-[#52525b]">
          {incident.rootCause || "—"}
        </p>
      </div>
    </div>
  );
}

export default function IncidentsTable({ incidents = [], loading = false }) {
  return (
    <div className="rounded-xl border border-[#1f1f23] bg-[#111113]">
      <div className="border-b border-[#1f1f23] px-5 py-4">
        <p className="text-sm font-semibold text-white">Incident History</p>
        <p className="text-xs text-[#52525b] mt-0.5">
          All incidents in the selected window
        </p>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_90px_110px_130px_100px_1fr] items-center gap-3 border-b border-[#1f1f23] px-5 py-3">
        {COLUMN_HEADERS.map((h) => (
          <p
            key={h}
            className="text-[11px] font-semibold uppercase tracking-wider text-[#3f3f46]"
          >
            {h}
          </p>
        ))}
      </div>

      {loading ? (
        <div className="divide-y divide-[#1a1a1d]">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="grid grid-cols-[1fr_90px_110px_130px_100px_1fr] items-center gap-3 px-5 py-4"
            >
              {Array.from({ length: 6 }).map((_, j) => (
                <Skeleton key={j} className="h-3 w-full max-w-[120px]" />
              ))}
            </div>
          ))}
        </div>
      ) : !incidents.length ? (
        <EmptyState
          icon={CheckCircle}
          title="No incidents in this window"
          description="Your services have been running smoothly."
          className="py-14"
        />
      ) : (
        incidents.map((incident) => (
          <IncidentTableRow
            key={incident.id || incident._id}
            incident={incident}
          />
        ))
      )}
    </div>
  );
}
