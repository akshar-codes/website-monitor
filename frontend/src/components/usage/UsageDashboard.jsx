import { Gauge, Clock, Database, Users, Zap } from "lucide-react";
import { Skeleton } from "../../components/ui/Skeleton";
import { cn } from "../../utils/cn";

function StatRow({ icon: Icon, label, value, percentUsed, atLimit }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-bg-elevated">
        <Icon size={14} className="text-text-secondary" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-white">{label}</p>
          <p className="text-xs text-text-secondary">{value}</p>
        </div>
        {percentUsed != null && (
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-bg-subtle">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                atLimit
                  ? "bg-red-500"
                  : percentUsed >= 80
                    ? "bg-amber-500"
                    : "bg-emerald-500",
              )}
              style={{ width: `${percentUsed}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

const FEATURE_LABELS = {
  teamAccess: "Team access",
  extendedRetention: "Extended data retention",
  unlimitedMonitors: "Unlimited monitors",
  fastPolling: "Sub-5-minute polling",
};

export default function UsageDashboard({ usage, loading }) {
  if (loading || !usage) {
    return (
      <div className="rounded-xl border border-border-subtle bg-bg-surface p-6">
        <div className="space-y-4">
          <Skeleton className="h-3 w-24" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const { monitors, interval, retention, team, features } = usage;

  return (
    <div className="rounded-xl border border-border-subtle bg-bg-surface p-6">
      <div className="mb-5">
        <p className="text-sm font-semibold text-white">
          Usage this billing cycle
        </p>
        <p className="mt-0.5 text-xs text-text-muted">
          Based on your {usage.planName} plan limits
        </p>
      </div>

      <div className="space-y-4">
        <StatRow
          icon={Gauge}
          label="Monitors"
          value={
            monitors.unlimited
              ? `${monitors.used} (unlimited)`
              : `${monitors.used} / ${monitors.limit}`
          }
          percentUsed={monitors.unlimited ? null : monitors.percentUsed}
          atLimit={monitors.atLimit}
        />
        <StatRow
          icon={Clock}
          label="Fastest check interval"
          value={`${interval.minSeconds}s`}
        />
        <StatRow
          icon={Database}
          label="Data retention"
          value={`${retention.days} days`}
        />
        <StatRow
          icon={Users}
          label="Team members"
          value={team.unlimited ? "Unlimited" : team.limit}
        />
      </div>

      <div className="mt-5 border-t border-border-subtle pt-4">
        <p className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-text-muted">
          <Zap size={11} /> Included features
        </p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(features).map(([key, enabled]) => (
            <span
              key={key}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px] font-medium",
                enabled
                  ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                  : "border-border-default bg-bg-elevated text-text-disabled",
              )}
            >
              {FEATURE_LABELS[key] || key}
            </span>
          ))}
        </div>
      </div>

      {monitors.atLimit && (
        <div className="mt-5 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3.5 py-3">
          <p className="text-xs text-amber-200">
            You&apos;ve used all {monitors.limit} monitors on your plan.
            Upgrade to add more.
          </p>
        </div>
      )}
    </div>
  );
}
