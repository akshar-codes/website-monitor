import { useState } from "react";
import { useDowntimeStats, useIncidentList } from "../hooks/useInsights";
import { useQuery } from "../hooks/useQuery";
import { useAuth } from "../hooks/useAuth";
import { PLANS } from "../constants/plans";
import * as monitorsApi from "../services/api/monitors";
import * as dashboardApi from "../services/api/dashboard";
import {
  Page,
  Panel,
  Button,
  Metric,
  Table,
  Status,
  Select,
} from "../components/ui/Primitives";
import {
  RefreshCw,
  Clock3,
  TriangleAlert,
  TrendingUp,
  ShieldCheck,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

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
    loading: _statsLoading,
    refetch: refetchStats,
  } = useDowntimeStats({ window: statsWindow });
  const stats = statsData?.data;

  const { data: allIncidentsData, loading: _allIncidentsLoading } =
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

  const monitorLines = chartData?.monitors || [];
  const points = chartData?.uptimeData || [];
  const latestStatus = statusDist || [];
  const colors = {
    up: "#08a879",
    down: "#ed5d62",
    degraded: "#e6a83e",
    unknown: "#8a9bb0",
  };
  return (
    <Page
      title="Insights"
      description="Explore reliability, outages, and response trends across your monitors."
      eyebrow="ANALYTICS"
      actions={
        <>
          <Select
            aria-label="Analytics period"
            value={statsWindow}
            onChange={(e) => setStatsWindow(e.target.value)}
          >
            {WINDOWS.map((w) => (
              <option value={w.value} key={w.value}>
                {w.label}
              </option>
            ))}
          </Select>
          <Button variant="secondary" onClick={handleRefresh}>
            <RefreshCw size={14} /> Refresh
          </Button>
        </>
      }
    >
      <div className="sw-metric-grid">
        <Metric
          label="Total downtime"
          value={
            stats?.totalDowntimeSeconds == null
              ? "—"
              : `${Math.floor(stats.totalDowntimeSeconds / 3600)}h ${Math.floor((stats.totalDowntimeSeconds % 3600) / 60)}m`
          }
          icon={Clock3}
          note={`During ${statsWindow}`}
          tone="amber"
        />
        <Metric
          label="Mean time to recovery"
          value={
            stats?.mttr == null ? "—" : `${Math.round(stats.mttr / 60)} min`
          }
          icon={TrendingUp}
          note="Resolved incidents"
          tone="blue"
        />
        <Metric
          label="Incidents"
          value={stats?.totalIncidents ?? allIncidents.length}
          icon={TriangleAlert}
          note="In selected period"
          tone="red"
        />
        <Metric
          label="Active monitors"
          value={latestStatus
            .filter((x) => x.name === "up")
            .reduce((sum, x) => sum + x.value, 0)}
          icon={ShieldCheck}
          note="Currently up"
        />
      </div>
      <div className="two-panel-grid">
        <Panel
          title="Uptime by monitor"
          subtitle="Compare reliability over time"
          actions={
            <div className="segmented-control">
              {WINDOWS.map((w) => (
                <button
                  key={w.value}
                  className={chartWindow === w.value ? "active" : ""}
                  onClick={() => setChartWindow(w.value)}
                >
                  {w.label}
                </button>
              ))}
            </div>
          }
        >
          {chartLoading ? (
            <div className="sw-loading">Building comparison…</div>
          ) : monitorLines.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={points}>
                <CartesianGrid stroke="#edf2f6" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={(v) =>
                    new Date(v).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })
                  }
                  tick={{ fontSize: 9 }}
                />
                <YAxis domain={[95, 100]} unit="%" tick={{ fontSize: 9 }} />
                <Tooltip />
                <Legend />
                {monitorLines.map((m, i) => (
                  <Line
                    key={m.id}
                    type="monotone"
                    dataKey={m.id}
                    name={m.name}
                    stroke={
                      ["#08a879", "#368ce0", "#df8f39", "#9a6bd6", "#e15e71"][
                        i % 5
                      ]
                    }
                    dot={false}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="sw-empty">
              <b>No monitor history to compare</b>
              <p>Start monitoring sites to build reliability trends.</p>
            </div>
          )}
        </Panel>
        <Panel
          title="Current status"
          subtitle="Availability across active monitors"
        >
          {statusDistLoading ? (
            <div className="sw-loading">Loading status…</div>
          ) : latestStatus.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={latestStatus}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={60}
                  outerRadius={88}
                  paddingAngle={3}
                >
                  {latestStatus.map((item) => (
                    <Cell
                      key={item.name}
                      fill={colors[item.name] || "#8a9bb0"}
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="sw-empty">
              <b>No status data yet</b>
            </div>
          )}
        </Panel>
      </div>
      <Panel
        title="Recent incidents"
        subtitle="Events contributing to your reliability metrics"
      >
        <Table
          columns={[
            {
              key: "monitor",
              label: "Monitor",
              render: (v, row) => v?.name || row.monitorName || "Monitor",
            },
            {
              key: "title",
              label: "Incident",
              render: (v, row) =>
                v || row.message || row.description || "Service interruption",
            },
            {
              key: "severity",
              label: "Severity",
              render: (v) => <Status value={v || "unknown"} />,
            },
            {
              key: "status",
              label: "Status",
              render: (v) => <Status value={v} />,
            },
            {
              key: "createdAt",
              label: "Started",
              render: (v) => (v ? new Date(v).toLocaleString() : "—"),
            },
          ]}
          rows={allIncidents.slice(0, 10)}
        />
      </Panel>
    </Page>
  );
}
