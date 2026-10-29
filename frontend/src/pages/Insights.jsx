import { useState } from "react";
import { useDowntimeStats, useIncidentList } from "../hooks/useInsights";
import { useQuery } from "../hooks/useQuery";
import { useAuth } from "../hooks/useAuth";
import { PLANS } from "../constants/plans";
import * as monitorsApi from "../services/api/monitors";
import * as dashboardApi from "../services/api/dashboard";
import { formatUptime } from "../utils/format";
import { cn } from "../utils/cn";

const WINDOWS = [
  { label: "24h", value: "24h" },
  { label: "7d", value: "7d" },
  { label: "30d", value: "30d" },
];

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
  const { plan } = useAuth();
  const defaultWindow = plan === PLANS.FREE ? "7d" : "30d";
  const [statsWindow, setStatsWindow] = useState(defaultWindow);
  const [chartWindow, setChartWindow] = useState("7d");

  const {
    data: statsData,
    loading: statsLoading,
    refetch: refetchStats,
  } = useDowntimeStats({ window: statsWindow });
  const stats = statsData?.data;

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

  return null;
}
