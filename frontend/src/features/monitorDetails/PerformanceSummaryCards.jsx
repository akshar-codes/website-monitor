import {
  TrendingUp,
  Clock,
  Gauge,
  AlertTriangle,
  Activity,
} from "lucide-react";
import StatCard from "../../components/cards/StatCard";
import {
  formatUptime,
  formatResponseTime,
  formatDuration,
} from "../../utils/format";

/**
 * Five-up KPI summary for the monitor analytics section. `overview` and
 * `range` come straight from GET /api/dashboard/monitors/:id/analytics
 * (see backend/src/services/dashboard.service.js#computeOverviewStats).
 */
export default function PerformanceSummaryCards({ overview, range, loading }) {
  const days = range?.days;

  const cards = [
    {
      label: "Uptime",
      value: overview ? formatUptime(overview.uptimePercentage) : "—",
      description: days
        ? `Over ${days} day${days !== 1 ? "s" : ""}`
        : undefined,
      icon: TrendingUp,
      iconColor: "text-emerald-400",
      iconBg: "bg-emerald-500/10",
      accent:
        overview && overview.uptimePercentage < 99
          ? "text-amber-400"
          : undefined,
    },
    {
      label: "Avg Response",
      value: overview ? formatResponseTime(overview.avgResponseTime) : "—",
      description: overview
        ? `Min ${formatResponseTime(overview.minResponseTime)} · Max ${formatResponseTime(overview.maxResponseTime)}`
        : undefined,
      icon: Clock,
      iconColor: "text-blue-400",
      iconBg: "bg-blue-500/10",
    },
    {
      label: "P95 Response",
      value: overview ? formatResponseTime(overview.p95ResponseTime) : "—",
      description: "95th percentile",
      icon: Gauge,
      iconColor: "text-purple-400",
      iconBg: "bg-purple-500/10",
    },
    {
      label: "Downtime",
      value: overview ? formatDuration(overview.downtimeSeconds) : "—",
      description: overview
        ? `${overview.failedChecks} failed check${overview.failedChecks !== 1 ? "s" : ""}`
        : undefined,
      icon: AlertTriangle,
      iconColor: "text-red-400",
      iconBg: "bg-red-500/10",
      accent:
        overview && overview.failedChecks > 0 ? "text-red-400" : undefined,
    },
    {
      label: "Total Checks",
      value: overview ? overview.totalChecks.toLocaleString() : "—",
      description: overview
        ? `${overview.successfulChecks.toLocaleString()} successful`
        : undefined,
      icon: Activity,
      iconColor: "text-text-secondary",
      iconBg: "bg-bg-overlay",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      {cards.map((card) => (
        <StatCard key={card.label} {...card} loading={loading} />
      ))}
    </div>
  );
}
