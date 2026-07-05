import { memo, useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useDashboard } from "../hooks/queries/useDashboard";
import DashboardHeader from "../components/dashboard/DashboardHeader";
import DashboardSkeleton from "../components/dashboard/DashboardSkeleton";
import AvailabilityCards from "../components/dashboard/AvailabilityCards";
import ResponseTimeTrendCard from "../components/dashboard/ResponseTimeTrendCard";
import HealthOverviewPanel from "../components/dashboard/HealthOverviewPanel";
import MonitorSummaryPanel from "../components/dashboard/MonitorSummaryPanel";
import QuickActionsPanel from "../components/dashboard/QuickActionsPanel";
import RecentEventsFeed from "../components/dashboard/RecentEventsFeed";
import ActivityFeed from "../components/dashboard/ActivityFeed";
import ActiveIncidentsList from "../components/dashboard/ActiveIncidentsList";
import ErrorBanner from "../components/shared/ErrorBanner";
import CreateMonitorModal from "../components/monitors/CreateMonitorModal";

function DashboardPage() {
  const { data, isLoading, isError, error, refetch, dataUpdatedAt } =
    useDashboard();
  const queryClient = useQueryClient();
  const [createMonitorOpen, setCreateMonitorOpen] = useState(false);

  const handleRefreshAll = useCallback(() => {
    queryClient.invalidateQueries();
  }, [queryClient]);

  const handleOpenCreateMonitor = useCallback(
    () => setCreateMonitorOpen(true),
    [],
  );
  const handleCloseCreateMonitor = useCallback(
    () => setCreateMonitorOpen(false),
    [],
  );

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (isError) {
    return (
      <div id="dashboard-error" className="animate-fade-in">
        <ErrorBanner error={error} onRetry={refetch} />
      </div>
    );
  }

  return (
    <div id="dashboard-page" className="space-y-6 animate-fade-in pb-4">
      {/* Header — title, live "updated" indicator, refresh, add monitor */}
      <DashboardHeader
        lastUpdatedAt={dataUpdatedAt}
        onRefresh={handleRefreshAll}
        onAddMonitor={handleOpenCreateMonitor}
      />

      {/* Availability — animated fleet-level stat cards */}
      <AvailabilityCards data={data} />

      {/* Primary grid — response time trend + monitor summary (left),
          health overview + incidents + quick actions (right) */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 space-y-5">
          <ResponseTimeTrendCard
            recentChecks={data?.recentChecks}
            responseTime={data?.responseTime}
          />
          <MonitorSummaryPanel />
        </div>

        <div className="space-y-5">
          <HealthOverviewPanel
            currentStatus={data?.currentStatus}
            uptime={data?.uptime}
          />
          <ActiveIncidentsList incidents={data?.activeIncidents?.latest} />
          <QuickActionsPanel onAddMonitor={handleOpenCreateMonitor} />
        </div>
      </div>

      {/* Secondary grid — recent notable events + full activity feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <RecentEventsFeed checks={data?.recentChecks} />
        <ActivityFeed
          recentChecks={data?.recentChecks}
          incidents={data?.activeIncidents?.latest}
        />
      </div>

      <CreateMonitorModal
        open={createMonitorOpen}
        onClose={handleCloseCreateMonitor}
      />
    </div>
  );
}

export default memo(DashboardPage);
