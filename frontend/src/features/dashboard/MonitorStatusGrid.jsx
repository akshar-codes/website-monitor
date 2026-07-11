import { Link } from "react-router-dom";
import StatusBadge from "../../components/ui/StatusBadge";
import { formatResponseTime, getDomain } from "../../utils/format";
import { Skeleton } from "../../components/ui/Skeleton";
import EmptyState from "../../components/ui/EmptyState";
import { Monitor, Plus } from "lucide-react";
import Button from "../../components/ui/Button";

function MonitorStatusCard({ name, url, status, responseTime }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border-subtle bg-bg-elevated px-4 py-3 transition-colors hover:border-border-default hover:bg-[#1a1a1d]">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-bg-surface">
        <span className="text-[10px] font-bold uppercase text-text-muted">
          {getDomain(url)?.charAt(0) || "?"}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[#e4e4e7]">{name}</p>
        <p className="truncate text-[11px] text-text-muted">{getDomain(url)}</p>
      </div>
      <div className="shrink-0 text-right">
        <StatusBadge status={status} size="sm" />
        {responseTime != null && (
          <p className="mt-0.5 text-[11px] text-text-muted">
            {formatResponseTime(responseTime)}
          </p>
        )}
      </div>
    </div>
  );
}

export default function MonitorStatusGrid({ monitors = [], loading = false }) {
  return (
    <div className="rounded-xl border border-border-subtle bg-bg-surface">
      <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-white">Monitor Status</p>
          <p className="text-xs text-text-muted">
            Current state of all active monitors
          </p>
        </div>
        <Link
          to="/monitors"
          className="text-[11px] font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
        >
          Manage →
        </Link>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14.5 rounded-lg" />
            ))}
          </div>
        ) : !monitors.length ? (
          <EmptyState
            icon={Monitor}
            title="No monitors yet"
            description="Add a monitor to start tracking uptime."
            action={
              <Link to="/monitors">
                <Button variant="primary" size="sm" icon={Plus}>
                  Add Monitor
                </Button>
              </Link>
            }
            className="py-8"
          />
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {monitors.map((m, i) => (
              <MonitorStatusCard
                key={m._id || m.id || i}
                name={m.name}
                url={m.url}
                status={m.status}
                responseTime={m.responseTime}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
