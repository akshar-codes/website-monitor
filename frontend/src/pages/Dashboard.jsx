import { useMemo } from "react";
import {
  Monitor,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";
import PageContainer from "../components/layout/PageContainer";
import PageHeader from "../components/layout/PageHeader";
import StatCard from "../components/cards/StatCard";
import SectionLabel from "../components/ui/SectionLabel";
import Button from "../components/ui/Button";
import ErrorState from "../components/ui/ErrorState";
import QuickActions from "../features/dashboard/QuickActions";
import RecentActivity from "../features/dashboard/RecentActivity";
import ActiveIncidents from "../features/dashboard/ActiveIncidents";
import OverviewChart from "../features/dashboard/OverviewChart";
import MonitorStatusGrid from "../features/dashboard/MonitorStatusGrid";
import { useDashboardSummary } from "../hooks/useMonitors";
import { formatResponseTime, formatUptime } from "../utils/format";
import { usePreferences } from "../hooks/usePreferences";

/**
 * The dashboard page is powered by a single aggregated request
 * (GET /api/dashboard/summary — see backend/src/services/dashboard.service.js
 * #getDashboardSummary) rather than assembling itself from several
 * independent, overlapping queries. This keeps the page's data flow to one
 * request/poll cycle and avoids the N+1 per-monitor fan-out the previous
 * implementation used for the status grid and the multi-window chart.
 */
export default function Dashboard() {
  const { preferences } = usePreferences();
  const dashboardPrefs = preferences?.dashboard;
  const { data, loading, error, refetch } = useDashboardSummary(
    (dashboardPrefs?.autoRefreshInterval || 30) * 1000,
  );

  const overview = data?.data?.overview;
  const monitorStatuses = data?.data?.monitorStatusList || [];
  const chartData = data?.data?.chartData || {};

  const checks = overview?.recentChecks || [];
  const incidentsList = overview?.activeIncidents?.latest || [];
  const incidentCount = overview?.activeIncidents?.count || 0;

  // Only true on the very first load — subsequent polling refreshes never
  // flash skeletons over data the user is already looking at.
  const isInitialLoad = loading && !data;
  const defaultWidgetOrder = [
    "quickActions",
    "overviewChart",
    "recentActivity",
    "activeIncidents",
    "monitorStatusGrid",
  ];
  const widgetOrder = dashboardPrefs?.widgetOrder || defaultWidgetOrder;
  const visibleWidgets = widgetOrder.filter(
    (key) =>
      dashboardPrefs?.widgets?.[
        `show${key[0].toUpperCase()}${key.slice(1)}`
      ] !== false,
  );
  const widgetContent = {
    quickActions: <QuickActions />,
    overviewChart: (
      <OverviewChart
        data={chartData}
        loading={isInitialLoad}
        defaultWindow={dashboardPrefs?.defaultWindow || "24h"}
      />
    ),
    recentActivity: <RecentActivity checks={checks} loading={isInitialLoad} />,
    activeIncidents: (
      <ActiveIncidents
        incidents={incidentsList}
        count={incidentCount}
        loading={isInitialLoad}
      />
    ),
    monitorStatusGrid: (
      <MonitorStatusGrid monitors={monitorStatuses} loading={isInitialLoad} />
    ),
  };

  const kpiCards = useMemo(
    () => [
      {
        label: "Total Monitors",
        value: overview?.monitors?.total ?? "—",
        description: `${overview?.monitors?.active ?? 0} active`,
        icon: Monitor,
        iconColor: "text-text-secondary",
        iconBg: "bg-bg-overlay",
      },
      {
        label: "Online",
        value: overview?.currentStatus?.up ?? "—",
        description: "Currently healthy",
        icon: CheckCircle,
        iconColor: "text-emerald-400",
        iconBg: "bg-emerald-500/10",
        accent: "text-emerald-400",
      },
      {
        label: "Offline",
        value:
          (overview?.currentStatus?.down ?? 0) +
          (overview?.currentStatus?.degraded ?? 0),
        description: `${overview?.currentStatus?.down ?? 0} down · ${overview?.currentStatus?.degraded ?? 0} degraded`,
        icon: XCircle,
        iconColor: "text-red-400",
        iconBg: "bg-red-500/10",
        accent:
          (overview?.currentStatus?.down ?? 0) > 0
            ? "text-red-400"
            : "text-white",
      },
      {
        label: "Avg Response",
        value: formatResponseTime(overview?.responseTime?.average),
        description: "Last 24 hours",
        icon: Clock,
        iconColor: "text-amber-400",
        iconBg: "bg-amber-500/10",
      },
    ],
    [overview],
  );

  // Full-page error state — only when the initial load fails outright and
  // there's no cached data to fall back to.
  if (error && !data) {
    return (
      <PageContainer>
        <PageHeader
          title="Dashboard"
          subtitle="Real-time overview of all your monitored services"
          className="mb-6"
        />
        <ErrorState
          title="Couldn't load your dashboard"
          description="Something went wrong while fetching your dashboard data. Check your connection and try again."
          onRetry={refetch}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Dashboard"
        subtitle="Real-time overview of all your monitored services"
        actions={
          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            onClick={refetch}
          >
            Refresh
          </Button>
        }
        className="mb-6"
      />

      {/* Stale-data banner — a background refresh failed but cached data
          from a previous successful load is still being shown. */}
      {error && data && (
        <div className="mb-6 flex flex-col gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 sm:flex-row sm:items-center sm:gap-3">
          <div className="flex items-center gap-2.5">
            <AlertTriangle size={16} className="shrink-0 text-amber-400" />
            <p className="text-xs text-amber-200">
              We couldn&apos;t refresh your dashboard just now — showing the
              last known data.
            </p>
          </div>
          <Button
            variant="ghost"
            size="xs"
            className="shrink-0 sm:ml-auto"
            onClick={refetch}
          >
            Retry
          </Button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="mb-6">
        <SectionLabel className="mb-3">Overview — System Status</SectionLabel>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {kpiCards.map((card) => (
            <StatCard key={card.label} {...card} loading={isInitialLoad} />
          ))}
        </div>
      </div>

      {/* Uptime summary banner */}
      {!isInitialLoad && overview && (
        <div className="mb-6 flex flex-col gap-4 rounded-xl border border-emerald-500/15 bg-emerald-500/5 px-5 py-4 sm:flex-row sm:items-center sm:gap-6">
          <div className="flex items-center gap-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
              <TrendingUp size={18} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">
                {formatUptime(overview.uptime?.percentage)} uptime
              </p>
              <p className="text-xs text-text-muted">
                {overview.uptime?.totalChecks?.toLocaleString()} checks in the
                last 24 hours ·{" "}
                {incidentCount > 0
                  ? `${incidentCount} active incident${incidentCount !== 1 ? "s" : ""}`
                  : "No active incidents"}
              </p>
            </div>
          </div>
          {incidentCount > 0 && (
            <div className="flex items-center gap-2 sm:ml-auto">
              <AlertTriangle size={14} className="text-amber-400" />
              <span className="text-xs font-medium text-amber-400">
                {incidentCount} incident{incidentCount !== 1 ? "s" : ""} need
                attention
              </span>
            </div>
          )}
        </div>
      )}

      <div className={dashboardPrefs?.compactMode ? "space-y-4" : "space-y-6"}>
        {visibleWidgets.map((key) => (
          <section
            key={key}
            className={
              dashboardPrefs?.compactMode ? "dashboard-compact-section" : ""
            }
          >
            {key === "overviewChart" && (
              <SectionLabel className="mb-3">Analytics</SectionLabel>
            )}
            {key === "monitorStatusGrid" && (
              <SectionLabel className="mb-3">Monitor Status</SectionLabel>
            )}
            {widgetContent[key]}
          </section>
        ))}
      </div>
    </PageContainer>
  );
}
