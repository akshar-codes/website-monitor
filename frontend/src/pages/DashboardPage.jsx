import { memo, useMemo } from "react";
import { useDashboard } from "../hooks/queries/useDashboard";
import LoadingSkeleton from "../components/shared/LoadingSkeleton";
import ErrorBanner from "../components/shared/ErrorBanner";
import StatusCardGrid from "../components/dashboard/StatusCardGrid";
import CurrentStatusBreakdown from "../components/dashboard/CurrentStatusBreakdown";
import SystemUptimeGauge from "../components/dashboard/SystemUptimeGauge";
import AvgResponseTimeCard from "../components/dashboard/AvgResponseTimeCard";
import ActiveIncidentsList from "../components/dashboard/ActiveIncidentsList";
import RecentChecksTable from "../components/dashboard/RecentChecksTable";

function DashboardPage() {
  const { data, isLoading, isError, error, refetch } = useDashboard();

  const cardData = useMemo(
    () =>
      data
        ? {
            monitors: data.monitors,
            activeIncidents: data.activeIncidents,
          }
        : null,
    [data],
  );

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in" id="dashboard-loading">
        <LoadingSkeleton variant="card" count={4} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <LoadingSkeleton variant="chart" count={1} />
            <LoadingSkeleton variant="chart" count={1} />
          </div>
          <div className="space-y-6">
            <LoadingSkeleton variant="chart" count={1} />
            <LoadingSkeleton variant="card" count={1} />
          </div>
        </div>
        <LoadingSkeleton variant="table" count={6} />
      </div>
    );
  }

  if (isError) {
    return (
      <div id="dashboard-error" className="animate-fade-in">
        <ErrorBanner error={error} onRetry={refetch} />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" id="dashboard-page">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-xl sm:text-2xl font-bold tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            Dashboard
          </h1>
          <p
            className="text-sm mt-0.5"
            style={{ color: "var(--text-tertiary)" }}
          >
            Real-time overview of your monitored services
          </p>
        </div>
      </div>

      {/* Status cards */}
      <StatusCardGrid data={cardData} />

      {/* Two-column layout: status breakdown + incidents | uptime gauge + response time */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column */}
        <div className="space-y-6">
          <CurrentStatusBreakdown data={data?.currentStatus} />
          <ActiveIncidentsList incidents={data?.activeIncidents?.latest} />
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <SystemUptimeGauge data={data?.uptime} />
          <AvgResponseTimeCard data={data?.responseTime} />
        </div>
      </div>

      {/* Recent checks table — full width */}
      <RecentChecksTable checks={data?.recentChecks} />
    </div>
  );
}

export default memo(DashboardPage);
