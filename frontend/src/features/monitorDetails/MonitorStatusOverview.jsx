import {
  TrendingUp,
  Clock,
  AlertTriangle,
  CheckCircle,
  Activity,
} from "lucide-react";
import StatCard from "../../components/cards/StatCard";
import StatusBadge from "../../components/ui/StatusBadge";
import { Skeleton } from "../../components/ui/Skeleton";
import {
  formatUptime,
  formatResponseTime,
  formatRelative,
} from "../../utils/format";

function CurrentStatusCard({ status, lastCheckedAt, nextCheckAt }) {
  return (
    <div className="rounded-xl border border-border-subtle bg-bg-surface p-5 transition-all duration-150 hover:border-border-default">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-text-muted">
          Current Status
        </p>
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-bg-overlay">
          <Activity size={15} className="text-text-secondary" />
        </div>
      </div>

      <div className="mt-2.5">
        <StatusBadge status={status} size="lg" />
      </div>

      <div className="mt-2.5 space-y-0.5">
        <p className="text-xs text-text-muted">
          Last checked {formatRelative(lastCheckedAt)}
        </p>
        {nextCheckAt && (
          <p className="text-[11px] text-text-disabled">
            Next check {formatRelative(nextCheckAt)}
          </p>
        )}
      </div>
    </div>
  );
}

export default function MonitorStatusOverview({ details, loading }) {
  if (loading || !details) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border-subtle bg-bg-surface p-5"
          >
            <div className="space-y-3">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const {
    currentStatus,
    uptime,
    responseTime,
    consecutiveFailures,
    lastCheckedAt,
    nextCheckAt,
  } = details;

  const isFailing = (consecutiveFailures ?? 0) > 0;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <CurrentStatusCard
        status={currentStatus}
        lastCheckedAt={lastCheckedAt}
        nextCheckAt={nextCheckAt}
      />

      <StatCard
        label="Uptime"
        value={formatUptime(uptime?.percentage)}
        description={`Over the last ${uptime?.window || "24h"}`}
        icon={TrendingUp}
        iconColor="text-emerald-400"
        iconBg="bg-emerald-500/10"
      />

      <StatCard
        label="Avg Response"
        value={formatResponseTime(responseTime?.average)}
        description={`Min ${formatResponseTime(responseTime?.min)} · Max ${formatResponseTime(responseTime?.max)}`}
        icon={Clock}
        iconColor="text-blue-400"
        iconBg="bg-blue-500/10"
      />

      <StatCard
        label="Consecutive Failures"
        value={consecutiveFailures ?? 0}
        description={
          isFailing ? "Since last successful check" : "All checks passing"
        }
        icon={isFailing ? AlertTriangle : CheckCircle}
        iconColor={isFailing ? "text-amber-400" : "text-emerald-400"}
        iconBg={isFailing ? "bg-amber-500/10" : "bg-emerald-500/10"}
        accent={isFailing ? "text-amber-400" : "text-white"}
      />
    </div>
  );
}
