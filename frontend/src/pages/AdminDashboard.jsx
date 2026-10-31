import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  useAdminDashboard,
  useAdminIncidents,
  useUserList,
} from "../hooks/useAdmin";
import { useQuery } from "../hooks/useQuery";
import * as healthApi from "../services/api/health";
import {
  Page,
  Panel,
  Button,
  Metric,
  Status,
  Table,
  Select,
  Input,
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
  const [incidentUserSearch, setIncidentUserSearch] = useState("");
  const [selectedIncidentUser, setSelectedIncidentUser] = useState(null);
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
  const siteHealthQuery = useQuery(() => healthApi.getHealth(), []);
  const siteHealth = siteHealthQuery.data;
  const userSearch = incidentUserSearch.trim();
  const userSearchQuery = useUserList(
    { search: userSearch, role: "user", limit: 8 },
    userSearch.length >= 2 && !selectedIncidentUser,
  );
  const userSearchResults = userSearchQuery.data?.data || [];
  const userIncidentsQuery = useAdminIncidents(
    { ownerId: selectedIncidentUser?.id, activeOnly: true, page: 1, limit: 20 },
    Boolean(selectedIncidentUser?.id),
  );
  const userIncidents = userIncidentsQuery.data?.data || [];
  const usersByPlan = Object.entries(data?.users?.byPlan || {}).map(
    ([name, stats]) => ({
      name,
      users: stats.users || 0,
      monitors: stats.monitors || 0,
    }),
  );
  const statuses = Object.entries(data?.monitors?.statuses || {});
  const hasRows =
    data?.recentRegistrations?.length || data?.recentAdminActivity?.length;

  return (
    <Page
      title="Administration"
      description="SiteWatch service health, customer accounts, and monitor operations."
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
          value={
            selectedIncidentUser
              ? (userIncidentsQuery.data?.pagination?.total ?? 0)
              : "—"
          }
          icon={TriangleAlert}
          tone="red"
          note={
            selectedIncidentUser
              ? "For selected customer"
              : "Select a customer below"
          }
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
        <Panel
          title="SiteWatch service health"
          subtitle="API and database status"
        >
          <div className="status-distribution">
            <div>
              <span>API server</span>
              <Status value={siteHealth?.status === "ok" ? "up" : "unknown"} />
            </div>
            <div>
              <span>Database</span>
              <Status
                value={siteHealth?.mongo === "connected" ? "up" : "unknown"}
              />
            </div>
            <div>
              <span>Service uptime</span>
              <b>
                {siteHealth?.uptime == null
                  ? "—"
                  : `${Math.floor(siteHealth.uptime / 3600)}h ${Math.floor((siteHealth.uptime % 3600) / 60)}m`}
              </b>
            </div>
            <div>
              <span>Environment</span>
              <b>{siteHealth?.environment || "—"}</b>
            </div>
          </div>
          {siteHealthQuery.error && (
            <Notice tone="warning">
              Could not read SiteWatch service health.
            </Notice>
          )}
        </Panel>
      </div>
      <div className="two-panel-grid">
        <Panel title="Monitor status" subtitle="Customer monitor fleet health">
          <div className="status-distribution">
            {statuses.map(([name, count]) => (
              <div key={name}>
                <Status value={name} />
                <b>{count}</b>
              </div>
            ))}
          </div>
        </Panel>
        <Panel
          title="Recent customers"
          subtitle="Select a customer to view account details and monitors"
          actions={
            <Link className="sw-button secondary" to="/admin/users">
              Manage all users
            </Link>
          }
        >
          <Table
            columns={[
              {
                key: "name",
                label: "User",
                render: (v, row) => (
                  <Link
                    to={`/admin/users/${row.id}`}
                    className="admin-customer-link"
                  >
                    <b>{v || row.email}</b>
                    <small className="table-secondary">{row.email}</small>
                  </Link>
                ),
              },
              { key: "plan", label: "Plan" },
              { key: "monitorCount", label: "Monitors" },
              {
                key: "createdAt",
                label: "Joined",
                render: (v) => (v ? new Date(v).toLocaleDateString() : "—"),
              },
            ]}
            rows={data?.recentRegistrations || []}
          />
        </Panel>
      </div>
      <Panel
        title="Customer incidents"
        subtitle={
          selectedIncidentUser
            ? `Active incidents for ${selectedIncidentUser.name || selectedIncidentUser.email}`
            : "Search for a customer to inspect their active monitor incidents"
        }
      >
        <Input
          aria-label="Search customer accounts"
          placeholder="Search customer name or email"
          value={
            selectedIncidentUser
              ? selectedIncidentUser.email
              : incidentUserSearch
          }
          onChange={(event) => {
            setSelectedIncidentUser(null);
            setIncidentUserSearch(event.target.value);
          }}
        />
        {selectedIncidentUser && (
          <Button
            variant="secondary"
            onClick={() => {
              setSelectedIncidentUser(null);
              setIncidentUserSearch("");
            }}
          >
            Clear customer
          </Button>
        )}
        {!selectedIncidentUser && userSearch.length >= 2 && (
          <div className="admin-customer-search-results">
            {userSearchQuery.loading ? (
              <div className="sw-loading">Searching customers...</div>
            ) : userSearchResults.length ? (
              userSearchResults.map((user) => (
                <button
                  type="button"
                  key={user.id}
                  onClick={() => setSelectedIncidentUser(user)}
                >
                  <b>{user.name || "Unnamed customer"}</b>
                  <span>{user.email}</span>
                </button>
              ))
            ) : (
              <small>No matching customer accounts.</small>
            )}
          </div>
        )}
        {selectedIncidentUser && userIncidentsQuery.loading && (
          <div className="sw-loading">Loading customer incidents...</div>
        )}
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
              render: (v, row) =>
                v ||
                row.rootCause ||
                row.triggerCheck?.failureReason ||
                "Service interruption",
            },
            {
              key: "severity",
              label: "Severity",
              render: (v) => <Status value={v} />,
            },
            {
              key: "startedAt",
              label: "Started",
              render: (v) => (v ? new Date(v).toLocaleString() : "—"),
            },
          ]}
          rows={selectedIncidentUser ? userIncidents : []}
          empty={
            selectedIncidentUser
              ? "This customer has no active incidents."
              : "Search for and select a customer to view incidents."
          }
        />
      </Panel>
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
