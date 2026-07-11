import React, { useMemo } from "react";
import {
  Monitor,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  AlertTriangle,
  TrendingUp,
  Activity,
} from "lucide-react";
import PageContainer from "../components/layout/PageContainer";
import PageHeader from "../components/layout/PageHeader";
import StatCard from "../components/cards/StatCard";
import SectionLabel from "../components/ui/SectionLabel";
import Button from "../components/ui/Button";
import RecentActivity from "../features/dashboard/RecentActivity";
import ActiveIncidents from "../features/dashboard/ActiveIncidents";
import OverviewChart from "../features/dashboard/OverviewChart";
import MonitorStatusGrid from "../features/dashboard/MonitorStatusGrid";
import {
  useOverview,
  useRecentHealthChecks,
  useActiveIncidents,
} from "../hooks/useMonitors";
import { useMonitorChartData } from "../hooks/useMonitors";
import { formatResponseTime, formatUptime } from "../utils/format";
import { useQuery } from "../hooks/useQuery";
import * as dashboardApi from "../services/api/dashboard";
import * as monitorsApi from "../services/api/monitors";

function useMultiWindowData() {
  return useQuery(async () => {
    const [monitorsRes] = await Promise.all([
      monitorsApi.getMonitors({ limit: 100 }),
    ]);
    const monitors = monitorsRes.data || [];
    if (!monitors.length) return { "24h": [], "7d": [], "30d": [] };

    const first = monitors[0];
    const [d24, d7, d30] = await Promise.allSettled([
      dashboardApi.getMonitorChartData(first.id, { window: "24h" }),
      dashboardApi.getMonitorChartData(first.id, { window: "7d" }),
      dashboardApi.getMonitorChartData(first.id, { window: "30d" }),
    ]);

    return {
      "24h": d24.status === "fulfilled" ? d24.value.data?.dataPoints || [] : [],
      "7d": d7.status === "fulfilled" ? d7.value.data?.dataPoints || [] : [],
      "30d": d30.status === "fulfilled" ? d30.value.data?.dataPoints || [] : [],
    };
  }, []);
}

function useMonitorStatusList() {
  return useQuery(async () => {
    const monitorsRes = await monitorsApi.getMonitors({
      limit: 100,
      active: "true",
    });
    const monitors = monitorsRes.data || [];

    const statsResults = await Promise.allSettled(
      monitors
        .slice(0, 12)
        .map((m) => dashboardApi.getMonitorStats(m.id, { window: "24h" })),
    );

    return monitors.slice(0, 12).map((m, i) => {
      const stats =
        statsResults[i].status === "fulfilled"
          ? statsResults[i].value.data
          : null;
      return {
        ...m,
        status: stats?.currentStatus || "unknown",
        responseTime: stats?.responseTime?.average || null,
      };
    });
  }, []);
}

export default function Dashboard() {
  const {
    data: overviewData,
    loading: overviewLoading,
    refetch,
  } = useOverview(30000);
  const { data: checksData, loading: checksLoading } = useRecentHealthChecks({
    limit: 10,
  });
  const { data: incidentsData, loading: incidentsLoading } = useActiveIncidents(
    { limit: 5 },
  );
  const { data: chartData, loading: chartLoading } = useMultiWindowData();
  const { data: monitorStatuses, loading: monitorStatusLoading } =
    useMonitorStatusList();

  const overview = overviewData?.data;
  const checks = checksData?.data || [];
  const incidentsList = incidentsData?.data || [];
  const incidentCount =
    incidentsData?.pagination?.total || overview?.activeIncidents?.count || 0;

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

      {/* KPI Cards */}
      <div className="mb-6">
        <SectionLabel className="mb-3">Overview — System Status</SectionLabel>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {kpiCards.map((card) => (
            <StatCard key={card.label} {...card} loading={overviewLoading} />
          ))}
        </div>
      </div>

      {/* Uptime summary banner */}
      {!overviewLoading && overview && (
        <div className="mb-6 flex items-center gap-6 rounded-xl border border-emerald-500/15 bg-emerald-500/5 px-5 py-4">
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
          {incidentCount > 0 && (
            <div className="ml-auto flex items-center gap-2">
              <AlertTriangle size={14} className="text-amber-400" />
              <span className="text-xs font-medium text-amber-400">
                {incidentCount} incident{incidentCount !== 1 ? "s" : ""} need
                attention
              </span>
            </div>
          )}
        </div>
      )}

      {/* Main chart */}
      <div className="mb-6">
        <SectionLabel className="mb-3">Analytics</SectionLabel>
        <OverviewChart data={chartData || {}} loading={chartLoading} />
      </div>

      {/* Bottom split — activity + incidents */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RecentActivity checks={checks} loading={checksLoading} />
        <ActiveIncidents
          incidents={incidentsList}
          count={incidentCount}
          loading={incidentsLoading}
        />
      </div>

      {/* Monitor status grid */}
      <div>
        <SectionLabel className="mb-3">Monitor Status</SectionLabel>
        <MonitorStatusGrid
          monitors={monitorStatuses || []}
          loading={monitorStatusLoading}
        />
      </div>
    </PageContainer>
  );
}
