import { useMemo, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useAdminDashboard } from "../hooks/useAdmin";
import {
  Page,
  Panel,
  Button,
  Metric,
  Status,
  Table,
  Select,
  Notice,
} from "../components/ui/Primitives";
import {
  Users,
  Activity,
  TriangleAlert,
  Globe2,
  RefreshCw,
} from "lucide-react";

("rounded-lg border border-[#303034] bg-bg-surface px-3 py-2 text-sm text-zinc-200 outline-none focus:border-emerald-500");

export default function AdminDashboard() {
  const [days, setDays] = useState(30);
  // Keep the query key stable across renders. Recomputing `new Date()` here
  // changed the ISO strings on every render, causing useQuery to refetch
  // after every response and quickly exhaust the API rate limit.
  const params = useMemo(() => {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 86400000);
    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    };
  }, [days]);
  const { data, loading, error, refetch } = useAdminDashboard(params);
  const usersByPlan = Object.entries(data?.users?.byPlan || {}).map(
    ([name, stats]) => ({
      name,
      users: stats.users || 0,
      monitors: stats.monitors || 0,
    }),
  );
  const statuses = Object.entries(data?.monitors?.statuses || {});
  const hasRows =
    data?.recentRegistrations?.length ||
    data?.incidents?.active?.length ||
    data?.recentAdminActivity?.length;

  return (
    <Page
      title="Administration"
      description="A live overview of users, monitors, incidents, and platform activity."
      eyebrow="SITEWATCH CONTROL ROOM"
      actions={
        <>
          <Select
            aria-label="Date range"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </Select>
          <Button variant="secondary" onClick={refetch}>
            <RefreshCw size={14} /> Refresh
          </Button>
        </>
      }
    >
      <div className="sw-metric-grid">
        <Metric
          label="Registered users"
          value={data?.users?.total ?? "—"}
          icon={Users}
          note="All accounts"
        />
        <Metric
          label="Active monitors"
          value={data?.monitors?.active ?? "—"}
          icon={Activity}
          tone="blue"
          note="Across all users"
        />
        <Metric
          label="Active incidents"
          value={data?.incidents?.activeCount ?? "—"}
          icon={TriangleAlert}
          tone="red"
          note="Need review"
        />
        <Metric
          label="New registrations"
          value={
            data?.users?.registeredInRange ??
            data?.recentRegistrations?.length ??
            "—"
          }
          icon={Globe2}
          tone="amber"
          note={`Last ${days} days`}
        />
      </div>
      {error && (
        <Notice tone="error">
          Could not load the admin overview.{" "}
          <button onClick={refetch}>Try again</button>
        </Notice>
      )}
      <div className="two-panel-grid">
        <Panel title="Users by plan" subtitle="Account distribution">
          {loading && !data ? (
            <div className="sw-loading">Loading analytics…</div>
          ) : usersByPlan.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={usersByPlan}
                  dataKey="users"
                  nameKey="name"
                  innerRadius={58}
                  outerRadius={85}
                  paddingAngle={3}
                >
                  {usersByPlan.map((entry, index) => (
                    <Cell
                      key={entry.name}
                      fill={
                        ["#08a879", "#3b8edb", "#e6a83e", "#8c6bd1"][index % 4]
                      }
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="sw-empty">
              <b>No account data</b>
            </div>
          )}
        </Panel>
        <Panel title="Monitor status" subtitle="Current fleet health">
          <div className="status-distribution">
            {statuses.map(([name, count]) => (
              <div key={name}>
                <Status value={name} />
                <b>{count}</b>
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <div className="two-panel-grid">
        <Panel title="Recent registrations" subtitle="Latest accounts">
          <Table
            columns={[
              {
                key: "name",
                label: "User",
                render: (v, row) => (
                  <>
                    <b>{v || row.email}</b>
                    <small className="table-secondary">{row.email}</small>
                  </>
                ),
              },
              { key: "plan", label: "Plan" },
              {
                key: "createdAt",
                label: "Joined",
                render: (v) => (v ? new Date(v).toLocaleDateString() : "—"),
              },
            ]}
            rows={data?.recentRegistrations || []}
          />
        </Panel>
        <Panel
          title="Active incidents"
          subtitle="Latest unresolved platform events"
        >
          <Table
            columns={[
              {
                key: "monitor",
                label: "Monitor",
                render: (v, row) => v?.name || row.monitorName || "—",
              },
              {
                key: "title",
                label: "Incident",
                render: (v, row) => v || row.message || "Service interruption",
              },
              {
                key: "severity",
                label: "Severity",
                render: (v) => <Status value={v} />,
              },
              {
                key: "createdAt",
                label: "Started",
                render: (v) => (v ? new Date(v).toLocaleString() : "—"),
              },
            ]}
            rows={data?.incidents?.active || []}
          />
        </Panel>
      </div>
      <Panel
        title="Recent administrator activity"
        subtitle="Audit trail of privileged actions"
      >
        <Table
          columns={[
            {
              key: "actor",
              label: "Admin",
              render: (v, row) => v?.name || row.actorName || "Administrator",
            },
            {
              key: "eventType",
              label: "Action",
              render: (v) => String(v || "Update").replaceAll("_", " "),
            },
            {
              key: "target",
              label: "Target",
              render: (v, row) => v?.name || row.targetName || "—",
            },
            {
              key: "createdAt",
              label: "When",
              render: (v) => (v ? new Date(v).toLocaleString() : "—"),
            },
          ]}
          rows={data?.recentAdminActivity || []}
        />
      </Panel>
      {!hasRows && (
        <Notice tone="info">
          The admin overview will fill in as the platform receives activity.
        </Notice>
      )}
    </Page>
  );
}
