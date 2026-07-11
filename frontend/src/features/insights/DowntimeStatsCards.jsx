import { AlertTriangle, Clock, TrendingDown, Shield } from "lucide-react";
import StatCard from "../../components/cards/StatCard";
import { formatDuration } from "../../utils/format";
import { Skeleton } from "../../components/ui/Skeleton";

export default function DowntimeStatsCards({ stats, loading }) {
  if (loading) {
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

  const cards = [
    {
      label: "Total Incidents",
      value: stats?.totalIncidents ?? "—",
      description: `${stats?.resolvedCount ?? 0} resolved · ${stats?.ongoingCount ?? 0} ongoing`,
      icon: AlertTriangle,
      iconColor: "text-amber-400",
      iconBg: "bg-amber-500/10",
    },
    {
      label: "Total Downtime",
      value:
        stats?.totalDowntimeSeconds != null
          ? formatDuration(stats.totalDowntimeSeconds)
          : "—",
      description: `In selected window`,
      icon: TrendingDown,
      iconColor: "text-red-400",
      iconBg: "bg-red-500/10",
    },
    {
      label: "MTTR",
      value: stats?.mttr != null ? formatDuration(stats.mttr) : "—",
      description: "Mean time to resolve",
      icon: Clock,
      iconColor: "text-blue-400",
      iconBg: "bg-blue-500/10",
    },
    {
      label: "Critical Incidents",
      value: stats?.bySeverity?.critical ?? "—",
      description: `${stats?.bySeverity?.major ?? 0} major · ${stats?.bySeverity?.minor ?? 0} minor`,
      icon: Shield,
      iconColor: "text-red-400",
      iconBg: "bg-red-500/10",
      accent:
        (stats?.bySeverity?.critical ?? 0) > 0 ? "text-red-400" : "text-white",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((card) => (
        <StatCard key={card.label} {...card} loading={false} />
      ))}
    </div>
  );
}
