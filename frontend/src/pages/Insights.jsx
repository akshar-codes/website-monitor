import React, { useState, useMemo } from "react";
import { BarChart3, RefreshCw } from "lucide-react";
import PageContainer from "../components/layout/PageContainer";
import PageHeader from "../components/layout/PageHeader";
import Button from "../components/ui/Button";
import SectionLabel from "../components/ui/SectionLabel";
import ChartCard from "../components/cards/ChartCard";
import StatCard from "../components/cards/StatCard";
import StatusPieChart from "../components/charts/StatusPieChart";
import DowntimeStatsCards from "../features/insights/DowntimeStatsCards";
import IncidentsTable from "../features/insights/IncidentsTable";
import UptimeTrendChart from "../features/insights/UptimeTrendChart";
import ResponseTimeTrendChart from "../features/insights/ResponseTimeTrendChart";
import Pagination from "../components/ui/Pagination";
import { useDowntimeStats, useIncidentList } from "../hooks/useInsights";
import { useQuery } from "../hooks/useQuery";
import * as monitorsApi from "../services/api/monitors";
import * as dashboardApi from "../services/api/dashboard";
import { formatUptime, formatResponseTime } from "../utils/format";
import { cn } from "../utils/cn";

const WINDOWS = [
  { label: "24h", value: "24h" },
  { label: "7d", value: "7d" },
  { label: "30d", value: "30d" },
];

function WindowSelector({ value, onChange }) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-[#27272a] bg-[#18181b] p-0.5">
      {WINDOWS.map((w) => (
        <button
          key={w.value}
          onClick={() => onChange(w.value)}
          className={cn(
            "rounded-md px-3 py-1 text-[11px] font-medium transition-all",
            value === w.value
              ? "bg-[#27272a] text-white"
              : "text-[#52525b] hover:text-[#a1a1aa]",
          )}
        >
          {w.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Fetches all monitors then their chart data for the window,
 * merges into multi-monitor time-series datasets.
 */
function useInsightChartData(window) {
  return useQuery(async () => {
    const monitorsRes = await monitorsApi.getMonitors({
      limit: 100,
      active: "true",
    });
    const monitors = (monitorsRes.data || []).slice(0, 5); // cap at 5 for clarity

    if (!monitors.length) return { uptimeData: [], rtData: [], monitors: [] };

    const chartResults = await Promise.allSettled(
      monitors.map((m) =>
        dashboardApi.getMonitorChartData(m.id || m._id, { window }),
      ),
    );

    // Build a unified timeline keyed by timestamp
    const timeMap = {};

    monitors.forEach((m, i) => {
      if (chartResults[i].status !== "fulfilled") return;
      const points = chartResults[i].value.data?.dataPoints || [];
      points.forEach((pt) => {
        const key = pt.timestamp;
        if (!timeMap[key]) timeMap[key] = { timestamp: key };
        timeMap[key][m.id || m._id] = pt.uptimePercentage ?? 0;
        // Store response time under a separate key prefix
        timeMap[key][`rt_${m.id || m._id}`] = pt.avgResponseTime ?? 0;
      });
    });

    const sorted = Object.values(timeMap).sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp),
    );

    // Split into uptime and RT datasets
    const uptimeData = sorted.map((row) => {
      const entry = { timestamp: row.timestamp };
      monitors.forEach((m) => {
        entry[m.id || m._id] = row[m.id || m._id] ?? null;
      });
      return entry;
    });

    const rtData = sorted.map((row) => {
      const entry = { timestamp: row.timestamp };
      monitors.forEach((m) => {
        entry[m.id || m._id] = row[`rt_${m.id || m._id}`] ?? null;
      });
      return entry;
    });

    return {
      monitors: monitors.map((m) => ({ id: m.id || m._id, name: m.name })),
      uptimeData,
      rtData,
    };
  }, [window]);
}

function useStatusDistribution() {
  return useQuery(async () => {
    const monitorsRes = await monitorsApi.getMonitors({
      limit: 100,
      active: "true",
    });
    const monitors = monitorsRes.data || [];

    if (!monitors.length) return [];

    const statsResults = await Promise.allSettled(
      monitors.map((m) =>
        dashboardApi.getMonitorStats(m.id || m._id, { window: "24h" }),
      ),
    );

    const counts = { up: 0, down: 0, degraded: 0, unknown: 0 };
    statsResults.forEach((r) => {
      if (r.status === "fulfilled") {
        const s = r.value.data?.currentStatus || "unknown";
        counts[s] = (counts[s] || 0) + 1;
      }
    });

    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, []);
}

export default function Insights() {
  const [statsWindow, setStatsWindow] = useState("30d");
  const [chartWindow, setChartWindow] = useState("7d");
  const [incidentPage, setIncidentPage] = useState(1);

  const {
    data: statsData,
    loading: statsLoading,
    refetch: refetchStats,
  } = useDowntimeStats({ window: statsWindow });
  const stats = statsData?.data;

  const { data: incidentsData, loading: incidentsLoading } = useIncidentList({
    page: incidentPage,
    limit: 15,
    status: "active",
  });
  const incidents = incidentsData?.data || [];
  const incidentPagination = incidentsData?.pagination;

  const { data: allIncidentsData, loading: allIncidentsLoading } =
    useIncidentList({
      page: 1,
      limit: 50,
      window: statsWindow,
    });
  const allIncidents = allIncidentsData?.data || [];

  const { data: chartData, loading: chartLoading } =
    useInsightChartData(chartWindow);
  const { data: statusDist, loading: statusDistLoading } =
    useStatusDistribution();

  const handleRefresh = () => {
    refetchStats();
  };

  return (
    <PageContainer>
      <PageHeader
        title="Insights"
        subtitle="Deeper trends across uptime, response time, and incident patterns"
        actions={
          <div className="flex items-center gap-2">
            <WindowSelector
              value={statsWindow}
              onChange={(v) => {
                setStatsWindow(v);
              }}
            />
            <Button
              variant="secondary"
              size="sm"
              icon={RefreshCw}
              onClick={handleRefresh}
            >
              Refresh
            </Button>
          </div>
        }
        className="mb-6"
      />

      {/* Downtime KPI stats */}
      <div className="mb-6">
        <SectionLabel className="mb-3">
          Downtime Overview — {statsWindow}
        </SectionLabel>
        <DowntimeStatsCards stats={stats} loading={statsLoading} />
      </div>

      {/* Trend charts */}
      <div className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <SectionLabel>Trends</SectionLabel>
          <WindowSelector value={chartWindow} onChange={setChartWindow} />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ChartCard
            title="Uptime Trend"
            subtitle="Per-monitor uptime over time"
            loading={chartLoading}
            height={260}
          >
            <UptimeTrendChart
              data={chartData?.uptimeData || []}
              monitors={chartData?.monitors || []}
              window={chartWindow}
            />
          </ChartCard>

          <ChartCard
            title="Response Time Trend"
            subtitle="Average response time per monitor"
            loading={chartLoading}
            height={260}
          >
            <ResponseTimeTrendChart
              data={chartData?.rtData || []}
              monitors={chartData?.monitors || []}
              window={chartWindow}
            />
          </ChartCard>
        </div>
      </div>

      {/* Status distribution + incident frequency */}
      <div className="mb-6">
        <SectionLabel className="mb-3">Distribution</SectionLabel>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Status pie */}
          <ChartCard
            title="Status Distribution"
            subtitle="Current monitor health breakdown"
            loading={statusDistLoading}
            height={240}
          >
            <StatusPieChart data={statusDist || []} />
          </ChartCard>

          {/* Severity breakdown */}
          <div className="rounded-xl border border-[#1f1f23] bg-[#111113] p-6">
            <p className="mb-1 text-sm font-semibold text-white">
              Incident Severity
            </p>
            <p className="mb-5 text-xs text-[#52525b]">
              Breakdown by severity in window
            </p>
            {statsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="flex justify-between">
                      <div className="h-2.5 w-16 animate-pulse rounded bg-[#1f1f23]" />
                      <div className="h-2.5 w-8 animate-pulse rounded bg-[#1f1f23]" />
                    </div>
                    <div className="h-2 w-full animate-pulse rounded-full bg-[#1f1f23]" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {[
                  {
                    label: "Critical",
                    value: stats?.bySeverity?.critical || 0,
                    color: "bg-red-500",
                  },
                  {
                    label: "Major",
                    value: stats?.bySeverity?.major || 0,
                    color: "bg-orange-500",
                  },
                  {
                    label: "Minor",
                    value: stats?.bySeverity?.minor || 0,
                    color: "bg-amber-500",
                  },
                ].map(({ label, value, color }) => {
                  const total = stats?.totalIncidents || 1;
                  const pct = Math.round((value / total) * 100);
                  return (
                    <div key={label}>
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-xs text-[#a1a1aa]">{label}</span>
                        <span className="text-xs font-semibold text-white">
                          {value}
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#27272a]">
                        <div
                          className={`h-full rounded-full ${color} transition-all duration-500`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Availability summary */}
          <div className="rounded-xl border border-[#1f1f23] bg-[#111113] p-6">
            <p className="mb-1 text-sm font-semibold text-white">
              Availability
            </p>
            <p className="mb-5 text-xs text-[#52525b]">
              Service health by monitor
            </p>
            {chartLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="h-2.5 w-28 animate-pulse rounded bg-[#1f1f23]" />
                    <div className="h-2.5 w-12 animate-pulse rounded bg-[#1f1f23]" />
                  </div>
                ))}
              </div>
            ) : !chartData?.monitors?.length ? (
              <p className="text-sm text-[#52525b]">No monitors available</p>
            ) : (
              <div className="space-y-3">
                {chartData.monitors.map((m) => {
                  // Calculate average uptime from the uptime data
                  const vals = (chartData.uptimeData || [])
                    .map((row) => row[m.id])
                    .filter((v) => v != null);
                  const avg =
                    vals.length > 0
                      ? vals.reduce((a, b) => a + b, 0) / vals.length
                      : null;
                  return (
                    <div
                      key={m.id}
                      className="flex items-center justify-between gap-3"
                    >
                      <p className="truncate text-xs text-[#a1a1aa]">
                        {m.name}
                      </p>
                      <p
                        className={`shrink-0 text-xs font-semibold ${
                          avg == null
                            ? "text-[#52525b]"
                            : avg >= 99
                              ? "text-emerald-400"
                              : avg >= 95
                                ? "text-amber-400"
                                : "text-red-400"
                        }`}
                      >
                        {avg != null ? formatUptime(avg) : "—"}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Incidents table */}
      <div>
        <SectionLabel className="mb-3">Incident History</SectionLabel>
        <IncidentsTable
          incidents={allIncidents}
          loading={allIncidentsLoading}
        />
      </div>
    </PageContainer>
  );
}
