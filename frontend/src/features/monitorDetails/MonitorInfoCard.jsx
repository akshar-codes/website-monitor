import { Globe, Timer, Calendar, RefreshCcw, Hash } from "lucide-react";
import { Skeleton } from "../../components/ui/Skeleton";
import { formatDateTime, formatInterval } from "../../utils/format";

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-bg-elevated">
        <Icon size={14} className="text-text-secondary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-text-muted">{label}</p>
        <p className="truncate text-sm font-medium text-white" title={value}>
          {value}
        </p>
      </div>
    </div>
  );
}

export default function MonitorInfoCard({ monitor, loading }) {
  if (loading || !monitor) {
    return (
      <div className="rounded-xl border border-border-subtle bg-bg-surface p-6">
        <div className="space-y-4">
          <Skeleton className="h-3 w-32" />
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border-subtle bg-bg-surface p-6">
      <p className="mb-5 text-sm font-semibold text-white">
        Monitor Information
      </p>

      <div className="space-y-4">
        <InfoRow icon={Globe} label="Endpoint URL" value={monitor.url} />
        <InfoRow
          icon={Timer}
          label="Check Interval"
          value={`Every ${formatInterval(monitor.interval)}`}
        />
        <InfoRow
          icon={Calendar}
          label="Created"
          value={formatDateTime(monitor.createdAt)}
        />
        <InfoRow
          icon={RefreshCcw}
          label="Last Updated"
          value={formatDateTime(monitor.updatedAt)}
        />
        <InfoRow icon={Hash} label="Monitor ID" value={monitor.id} />
      </div>
    </div>
  );
}
