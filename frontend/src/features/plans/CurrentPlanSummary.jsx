import { CalendarClock, Gauge, Database, Users } from "lucide-react";
import PlanBadge from "../../components/ui/PlanBadge";
import { Skeleton } from "../../components/ui/Skeleton";
import { formatDate } from "../../utils/format";

function LimitStat({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-bg-elevated">
        <Icon size={14} className="text-text-secondary" />
      </div>
      <div>
        <p className="text-xs font-medium text-white">{value}</p>
        <p className="text-[11px] text-text-muted">{label}</p>
      </div>
    </div>
  );
}

export default function CurrentPlanSummary({ currentPlan, loading }) {
  if (loading) {
    return (
      <div className="rounded-xl border border-border-subtle bg-bg-surface p-6">
        <div className="space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-3 w-56" />
        </div>
      </div>
    );
  }

  const { definition, status, startedAt } = currentPlan || {};
  if (!definition) return null;

  const { limits } = definition;

  return (
    <div className="rounded-xl border border-border-subtle bg-bg-surface p-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-text-muted">
            Current plan
          </p>
          <div className="flex items-center gap-2.5">
            <p className="text-2xl font-bold tracking-tight text-white">
              {definition.name}
            </p>
            <PlanBadge plan={definition.id} size="md" />
          </div>
          <p className="mt-1 text-xs text-text-muted">{definition.tagline}</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] text-text-muted">Member since</p>
          <p className="text-xs font-medium text-text-secondary">
            {formatDate(startedAt)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 border-t border-border-subtle pt-5 sm:grid-cols-4">
        <LimitStat
          icon={Gauge}
          label="Monitors"
          value={limits.maxMonitors == null ? "Unlimited" : limits.maxMonitors}
        />
        <LimitStat
          icon={CalendarClock}
          label="Check interval"
          value={`${limits.minCheckIntervalSeconds}s min`}
        />
        <LimitStat
          icon={Database}
          label="Data retention"
          value={`${limits.dataRetentionDays}d`}
        />
        <LimitStat
          icon={Users}
          label="Team members"
          value={limits.teamMembers == null ? "Unlimited" : limits.teamMembers}
        />
      </div>

      {status && status !== "active" && (
        <p className="mt-4 text-[11px] text-amber-400">Plan status: {status}</p>
      )}
    </div>
  );
}
