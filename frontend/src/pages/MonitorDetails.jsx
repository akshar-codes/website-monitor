import { useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import PageContainer from "../components/layout/PageContainer";
import Button from "../components/ui/Button";
import ErrorState from "../components/ui/ErrorState";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import SectionLabel from "../components/ui/SectionLabel";
import ChartCard from "../components/cards/ChartCard";
import ResponseTimeChart from "../components/charts/ResponseTimeChart";
import UptimeChart from "../components/charts/UptimeChart";
import {
  SeverityBadge,
  IncidentStatusBadge,
} from "../components/ui/SeverityBadge";
import MonitorFormModal from "../features/monitors/MonitorFormModal";
import MonitorDetailHeader from "../features/monitorDetails/MonitorDetailHeader";
import MonitorStatusOverview from "../features/monitorDetails/MonitorStatusOverview";
import MonitorInfoCard from "../features/monitorDetails/MonitorInfoCard";
import MonitorRecentChecks from "../features/monitorDetails/MonitorRecentChecks";
import MonitorAnalytics from "../features/monitorDetails/MonitorAnalytics";
import { useMonitorDetails, useMonitorMutations } from "../hooks/useMonitors";
import { useUsage } from "../hooks/useUsage";
import { ROUTES } from "../constants/routes";
import { formatRelative } from "../utils/format";

const WINDOWS = [
  { label: "24h", value: "24h" },
  { label: "7d", value: "7d" },
  { label: "30d", value: "30d" },
];

export default function MonitorDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [window, setWindow] = useState("24h");
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data, loading, error, refetch } = useMonitorDetails(id, window);
  const details = data?.data;

  const { data: usageData } = useUsage();
  const usage = usageData?.data;

  const handleMutationSuccess = useCallback(
    (action) => {
      if (action === "delete") {
        navigate(ROUTES.MONITORS, { replace: true });
        return;
      }
      setEditOpen(false);
      setDeleteOpen(false);
      refetch();
    },
    [navigate, refetch],
  );

  const { updateMonitor, deleteMonitor, toggleMonitor, submitting } =
    useMonitorMutations(handleMutationSuccess);

  const handleFormSubmit = (payload) => {
    updateMonitor(id, payload);
  };

  // Full-page error — the monitor doesn't exist, isn't owned by the
  // caller, or the request failed outright with no cached data to show.
  if (error && !data) {
    return (
      <PageContainer>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(ROUTES.MONITORS)}
          className="mb-4"
        >
          ← Back to Monitors
        </Button>
        <ErrorState
          title="Couldn't load this monitor"
          description="It may have been deleted, or something went wrong while fetching its details."
          onRetry={refetch}
        />
      </PageContainer>
    );
  }

  const isInitialLoad = loading && !data;

  return (
    <PageContainer>
      <MonitorDetailHeader
        monitor={details?.monitor}
        loading={isInitialLoad}
        onBack={() => navigate(ROUTES.MONITORS)}
        onRefresh={refetch}
        onEdit={() => setEditOpen(true)}
        onToggle={() =>
          toggleMonitor(id, !details?.monitor?.active, details?.monitor?.name)
        }
        onDelete={() => setDeleteOpen(true)}
      />

      {/* Active incident banner */}
      {details?.activeIncident && (
        <div className="mb-6 flex flex-col gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-5 py-4 sm:flex-row sm:items-center">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-red-300">
                Active incident
              </p>
              <SeverityBadge severity={details.activeIncident.severity} />
              <IncidentStatusBadge status={details.activeIncident.status} />
            </div>
            <p className="mt-1 text-xs text-red-200/80">
              Started {formatRelative(details.activeIncident.startedAt)}
              {details.activeIncident.rootCause
                ? ` · ${details.activeIncident.rootCause}`
                : ""}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 text-red-300 hover:bg-red-500/10 hover:text-red-200"
            onClick={() => navigate(ROUTES.INSIGHTS)}
          >
            View insights →
          </Button>
        </div>
      )}

      {/* Overview / current status */}
      <div className="mb-6">
        <MonitorStatusOverview details={details} loading={isInitialLoad} />
      </div>

      {/* Charts + monitor info */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <ChartCard
            title="Response Time"
            subtitle="Average response time over the selected window"
            loading={isInitialLoad}
            height={240}
            windows={WINDOWS}
            window={window}
            onWindowChange={setWindow}
          >
            <ResponseTimeChart
              data={details?.chart?.dataPoints || []}
              window={window}
            />
          </ChartCard>

          <ChartCard
            title="Uptime"
            subtitle="Uptime percentage over the selected window"
            loading={isInitialLoad}
            height={220}
          >
            <UptimeChart
              data={details?.chart?.dataPoints || []}
              window={window}
            />
          </ChartCard>
        </div>

        <div>
          <MonitorInfoCard monitor={details?.monitor} loading={isInitialLoad} />
        </div>
      </div>

      {/* Recent checks */}
      <div className="mb-6">
        <MonitorRecentChecks
          checks={details?.recentChecks || []}
          loading={isInitialLoad}
        />
      </div>

      {/* Analytics & performance insights — custom date-range reporting,
          independent of the live-status view above (see
          features/monitorDetails/MonitorAnalytics.jsx). */}
      <div>
        <SectionLabel className="mb-3">
          Analytics &amp; Performance Insights
        </SectionLabel>
        <MonitorAnalytics
          monitorId={id}
          retentionDays={usage?.retention?.days}
        />
      </div>

      {/* Edit modal */}
      <MonitorFormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSubmit={handleFormSubmit}
        monitor={details?.monitor}
        loading={submitting}
        minIntervalSeconds={usage?.interval?.minSeconds ?? 30}
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => deleteMonitor(id, details?.monitor?.name)}
        title="Delete Monitor"
        description={`"${details?.monitor?.name}" and all its history will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete Monitor"
        loading={submitting}
      />
    </PageContainer>
  );
}
