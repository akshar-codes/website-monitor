import { useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMonitor } from "../hooks/queries/useMonitor";
import { useMonitorStats } from "../hooks/queries/useMonitorStats";
import { useMonitorChartData } from "../hooks/queries/useMonitorChartData";
import { useUpdateMonitor } from "../hooks/mutations/useUpdateMonitor";
import { useDeleteMonitor } from "../hooks/mutations/useDeleteMonitor";
import MonitorHeader from "../components/monitors/MonitorHeader";
import MonitorStatsCards from "../components/monitors/MonitorStatsCards";
import ResponseTimeChart from "../components/monitors/ResponseTimeChart";
import RecentChecksTimeline from "../components/monitors/RecentChecksTimeline";
import ActiveIncidentBanner from "../components/monitors/ActiveIncidentBanner";
import {
  ResponseTimeHistoryChart,
  UptimeHistoryChart,
  StatusTrendChart,
} from "../components/charts";
import EditMonitorModal from "../components/monitors/EditMonitorModal";
import WindowSelector from "../components/shared/WindowSelector";
import ConfirmDialog from "../components/shared/ConfirmDialog";
import LoadingSkeleton from "../components/shared/LoadingSkeleton";
import ErrorBanner from "../components/shared/ErrorBanner";

export default function MonitorDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: monitor, isPending, isError, error } = useMonitor(id);
  const stats24h = useMonitorStats(id, "24h");
  const stats7d = useMonitorStats(id, "7d");
  const stats30d = useMonitorStats(id, "30d");
  const updateMutation = useUpdateMonitor();
  const deleteMutation = useDeleteMonitor();

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [chartWindow, setChartWindow] = useState("24h");

  const chartData = useMonitorChartData(id, chartWindow);

  const handleToggleActive = useCallback(() => {
    if (monitor) {
      updateMutation.mutate({
        id: monitor._id || monitor.id,
        data: { active: !monitor.active },
      });
    }
  }, [monitor, updateMutation]);

  const handleDelete = useCallback(() => {
    deleteMutation.mutate(id, {
      onSuccess: () => {
        setDeleteOpen(false);
        navigate("/monitors");
      },
    });
  }, [id, deleteMutation, navigate]);

  if (isPending) {
    return (
      <div className="space-y-6 animate-fade-in">
        <LoadingSkeleton variant="card" count={1} />
        <LoadingSkeleton variant="card" count={5} />
        <LoadingSkeleton variant="chart" />
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorBanner error={error} onRetry={() => window.location.reload()} />
    );
  }

  if (!monitor) {
    return <ErrorBanner error="Monitor not found" />;
  }

  const currentStatus = stats24h.data?.currentStatus || "unknown";
  const activeIncident = stats24h.data?.activeIncident || null;
  const chartPoints = chartData.data?.dataPoints || [];

  return (
    <div className="space-y-6 animate-fade-in">
      <MonitorHeader
        monitor={monitor}
        currentStatus={currentStatus}
        onEdit={() => setEditOpen(true)}
        onDelete={() => setDeleteOpen(true)}
        onToggleActive={handleToggleActive}
      />

      <ActiveIncidentBanner incident={activeIncident} />

      <MonitorStatsCards
        stats24h={stats24h.data}
        stats7d={stats7d.data}
        stats30d={stats30d.data}
        consecutiveFailures={monitor.consecutiveFailures}
      />

      {/* ── Monitoring Charts Section ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2
            className="text-base font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            Performance Analytics
          </h2>
          <WindowSelector value={chartWindow} onChange={setChartWindow} />
        </div>

        <ResponseTimeHistoryChart
          data={chartPoints}
          window={chartWindow}
          loading={chartData.isPending}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <UptimeHistoryChart
            data={chartPoints}
            window={chartWindow}
            loading={chartData.isPending}
          />
          <StatusTrendChart
            data={chartPoints}
            window={chartWindow}
            loading={chartData.isPending}
          />
        </div>
      </div>

      {/* ── Recent Activity ── */}
      <ResponseTimeChart checks={stats24h.data?.recentChecks} />

      <RecentChecksTimeline checks={stats24h.data?.recentChecks} />

      <EditMonitorModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        monitor={monitor}
      />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete Monitor"
        message={`Are you sure you want to delete "${monitor.name}"? This action cannot be undone.`}
        confirmText="Delete"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
