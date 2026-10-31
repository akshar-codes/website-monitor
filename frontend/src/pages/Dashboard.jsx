import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  Bell,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Clock3,
  FileText,
  Globe2,
  Menu,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  TriangleAlert,
  X,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useDashboardSummary } from "../hooks/useMonitors";
import { useActivitySummary } from "../hooks/useActivity";
import { usePreferences } from "../hooks/usePreferences";
import { useAuth } from "../hooks/useAuth";
import { useNotificationsCenter } from "../hooks/useNotifications";
import {
  formatResponseTime,
  formatUptime,
  formatRelative,
  formatDate,
  formatDateTime,
  formatChartDate,
} from "../utils/format";
import { useQuery } from "../hooks/useQuery";
import * as healthApi from "../services/api/health";
import Sparkline from "../components/charts/Sparkline";
import SegmentedControl from "../components/ui/SegmentedControl";
import { useSidebarLayout } from "../hooks/useSidebarLayout";
import WorkspaceSidebar from "../components/layout/WorkspaceSidebar";
import { TranslateTree, useTranslation } from "../i18n";

const statusLabel = (status) =>
  status === "up"
    ? "Up"
    : status === "down"
      ? "Down"
      : status === "degraded"
        ? "Degraded"
        : status === "paused" || status === "inactive"
          ? "Paused"
          : "Unknown";
const shortUrl = (url = "") =>
  url.replace(/^https?:\/\//, "").replace(/\/$/, "");

function MiniTrend({ color = "#08a879", values }) {
  const t = useTranslation();
  if (!values?.length) return null;
  return (
    <div className="mini-trend">
      <Sparkline values={values} color={color} label={t("Recent trend")} />
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, color = "green", spark }) {
  const t = useTranslation();
  return (
    <article className="metric-card">
      <div className={`metric-icon ${color}`}>
        <Icon size={18} />
      </div>
      <div className="metric-main">
        <span className="eyebrow">{t(label)}</span>
        <strong>{value}</strong>
        <div className="metric-foot">
          <span>
            {t(spark?.length ? "Trend · last 7 days" : "Current snapshot")}
          </span>
        </div>
      </div>
      <MiniTrend
        values={spark}
        color={color === "red" ? "#f05c62" : "#08a879"}
      />
    </article>
  );
}

function ChartTooltip({ active, payload, label, suffix = "" }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <b>{label}</b>
      <span>
        {payload[0].value}
        {suffix}
      </span>
    </div>
  );
}

export default function Dashboard() {
  const t = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { preferences } = usePreferences();
  const { user, logout } = useAuth();
  const { unreadTotal } = useNotificationsCenter();
  const { collapsed, mobileOpen, toggle, closeMobile } = useSidebarLayout();
  const { data: systemHealth } = useQuery(() => healthApi.getHealth(), []);
  const dashboardPrefs = preferences?.dashboard;
  const { data, loading, error, refetch } = useDashboardSummary(
    (dashboardPrefs?.autoRefreshInterval || 30) * 1000,
  );
  const [selectedWindowKey, setWindowKey] = useState(null);
  const windowKey =
    selectedWindowKey ?? (dashboardPrefs?.defaultWindow || "24h");
  const { data: activityData } = useActivitySummary(5);
  const recentActivities = activityData?.data?.recent || [];
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");
  const summary = data?.data || data || {};
  const overview = summary.overview || {};
  const monitors = useMemo(
    () => summary.monitorStatusList || [],
    [summary.monitorStatusList],
  );
  const chartData = summary.chartData || {};
  const incidents = overview.activeIncidents?.latest || [];
  const incidentCount = overview.activeIncidents?.count || 0;
  const currentStatus = overview.currentStatus || {};
  const chartRows = chartData[windowKey] || [];
  const uptimeData = chartRows
    .map((point) => ({
      day: formatChartDate(point.timestamp, windowKey),
      value: point.uptimePercentage,
    }))
    .filter((point) => point.value != null);
  const responseData = chartRows
    .filter((point) => point.avgResponseTime != null)
    .map((point) => ({
      day: formatChartDate(point.timestamp, windowKey),
      value: point.avgResponseTime,
    }));
  const uptime = overview.uptime?.percentage;
  const response = overview.responseTime?.average;
  const filteredMonitors = useMemo(
    () =>
      monitors.filter((monitor) => {
        const status = statusLabel(monitor.status).toLowerCase();
        const matchFilter = filter === "All" || status === filter.toLowerCase();
        return (
          matchFilter &&
          `${monitor.name} ${monitor.url}`
            .toLowerCase()
            .includes(query.toLowerCase())
        );
      }),
    [monitors, filter, query],
  );
  const displayName = user?.name?.split(" ")[0] || "there";

  return (
    <TranslateTree>
      <div
        className={`site-shell${collapsed ? " sidebar-collapsed" : ""}${mobileOpen ? " mobile-sidebar-open" : ""}`}
      >
        {mobileOpen && (
          <button
            className="sidebar-backdrop"
            aria-label="Close navigation menu"
            onClick={closeMobile}
          />
        )}
        <WorkspaceSidebar
          collapsed={collapsed}
          onToggle={toggle}
          onNavigate={closeMobile}
          user={user}
          incidentCount={incidentCount}
          onSignOut={async () => {
            await logout();
            navigate("/login", { replace: true });
          }}
        />

        <div className="site-workspace">
          <header className="site-topbar">
            <button
              className="mobile-menu-toggle"
              onClick={toggle}
              aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
            >
              {mobileOpen ? <X size={19} /> : <Menu size={19} />}
            </button>
            <label className="global-search">
              <Search size={16} />
              <input
                placeholder="Search monitors, domains..."
                aria-label="Search monitors and domains"
                onChange={(event) => setQuery(event.target.value)}
              />
              <kbd>⌘ K</kbd>
            </label>
            <div className="topbar-actions">
              <Link
                className={`notification-button${location.pathname === "/notifications" ? " selected" : ""}`}
                to="/notifications"
                aria-label={`${unreadTotal} unread notifications`}
                aria-current={
                  location.pathname === "/notifications" ? "page" : undefined
                }
              >
                <Bell size={18} />
                {unreadTotal > 0 && <i />}
              </Link>
            </div>
          </header>
          <main
            className={`dashboard-page${dashboardPrefs?.compactMode ? " compact-dashboard" : ""}`}
          >
            <div className="welcome-row">
              <div>
                <h1>
                  {t("Good morning,")} {displayName}{" "}
                  <span aria-hidden="true">☀️</span>
                </h1>
                <p>Here’s what’s happening with your websites today.</p>
              </div>
              <div className="date-stamp">
                {formatDate(new Date())}
                <small>
                  {formatDateTime(new Date()).split(" ").slice(-2).join(" ")}
                </small>
              </div>
            </div>
            {error && (
              <div className="dashboard-error">
                <CircleAlert size={16} /> Couldn’t refresh dashboard data.{" "}
                <button onClick={refetch}>Try again</button>
              </div>
            )}
            <div className="dashboard-layout">
              <section className="dashboard-main-column">
                <div className="metric-grid">
                  <MetricCard
                    icon={TrendingUp}
                    label="Overall Uptime"
                    value={uptime == null ? "—" : formatUptime(uptime)}
                    spark={uptimeData.map((point) => point.value)}
                  />
                  <MetricCard
                    icon={Globe2}
                    label="Total Monitors"
                    value={overview.monitors?.total ?? "—"}
                    color="aqua"
                  />
                  <MetricCard
                    icon={TriangleAlert}
                    label="Active Incidents"
                    value={incidentCount}
                    color={incidentCount ? "red" : "green"}
                  />
                  <MetricCard
                    icon={Clock3}
                    label="Avg. Response Time"
                    value={
                      response == null ? "—" : formatResponseTime(response)
                    }
                    spark={responseData.map((point) => point.value)}
                  />
                </div>

                {dashboardPrefs?.widgets?.showOverviewChart !== false && (
                  <div className="chart-grid">
                    <article className="panel chart-panel uptime-panel">
                      <div className="panel-heading">
                        <div>
                          <h2>Uptime Overview</h2>
                          <p>Uptime across your monitors</p>
                        </div>
                        <SegmentedControl
                          label="Chart time range"
                          value={windowKey}
                          onChange={setWindowKey}
                          options={[
                            { value: "24h", label: "24H" },
                            { value: "7d", label: "7D" },
                            { value: "30d", label: "30D" },
                          ]}
                        />
                      </div>
                      <div className="chart-area">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart
                            data={uptimeData}
                            margin={{ top: 12, right: 6, left: -18, bottom: 0 }}
                          >
                            <defs>
                              <linearGradient
                                id="uptimeFill"
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="1"
                              >
                                <stop
                                  offset="0%"
                                  stopColor="#10b981"
                                  stopOpacity={0.18}
                                />
                                <stop
                                  offset="100%"
                                  stopColor="#10b981"
                                  stopOpacity={0.015}
                                />
                              </linearGradient>
                            </defs>
                            <CartesianGrid vertical stroke="#edf2f6" />
                            <XAxis
                              dataKey="day"
                              tickLine={false}
                              axisLine={false}
                              tick={{ fill: "#687d95", fontSize: 11 }}
                            />
                            <YAxis
                              domain={[98, 100]}
                              ticks={[98, 98.5, 99, 99.5, 100]}
                              tickFormatter={(v) => `${v}%`}
                              tickLine={false}
                              axisLine={false}
                              tick={{ fill: "#687d95", fontSize: 11 }}
                            />
                            <Tooltip content={<ChartTooltip suffix="%" />} />
                            <Area
                              dataKey="value"
                              type="monotone"
                              stroke="#08ad7c"
                              strokeWidth={2.2}
                              fill="url(#uptimeFill)"
                              dot={{ r: 2, fill: "#08ad7c", strokeWidth: 0 }}
                              activeDot={{ r: 4 }}
                              isAnimationActive={false}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </article>
                    <article className="panel chart-panel response-panel">
                      <div className="panel-heading">
                        <div>
                          <h2>Response Time</h2>
                          <p>Average response time (ms)</p>
                        </div>
                        <div className="chart-current">
                          <b>
                            {response == null
                              ? "—"
                              : formatResponseTime(response)}
                          </b>
                          <span>{windowKey.toUpperCase()} window</span>
                        </div>
                      </div>
                      <div className="chart-area">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart
                            data={responseData}
                            margin={{ top: 12, right: 8, left: -16, bottom: 0 }}
                          >
                            <CartesianGrid stroke="#edf2f6" />
                            <XAxis
                              dataKey="day"
                              tickLine={false}
                              axisLine={false}
                              tick={{ fill: "#687d95", fontSize: 11 }}
                            />
                            <YAxis
                              domain={[0, "auto"]}
                              tickLine={false}
                              axisLine={false}
                              tick={{ fill: "#687d95", fontSize: 11 }}
                            />
                            <Tooltip content={<ChartTooltip suffix=" ms" />} />
                            <Line
                              dataKey="value"
                              type="monotone"
                              stroke="#08ad7c"
                              strokeWidth={2.2}
                              dot={{ r: 2, fill: "#08ad7c", strokeWidth: 0 }}
                              activeDot={{ r: 4 }}
                              isAnimationActive={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </article>
                  </div>
                )}

                {dashboardPrefs?.widgets?.showMonitorStatusGrid !== false && (
                  <article className="panel monitors-panel">
                    <div className="panel-heading monitors-heading">
                      <div>
                        <h2>Monitors</h2>
                        <p>Your website monitors at a glance</p>
                      </div>
                      <Link className="view-all" to="/monitors">
                        View all <ArrowRight size={14} />
                      </Link>
                    </div>
                    <label className="monitor-search">
                      <Search size={15} />
                      <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Search monitors..."
                      />
                    </label>
                    <div className="filter-pills">
                      {[
                        ["All", monitors.length],
                        ["Up", currentStatus.up ?? 0],
                        [
                          "Down",
                          (currentStatus.down ?? 0) +
                            (currentStatus.degraded ?? 0),
                        ],
                        ["Paused", overview.monitors?.inactive ?? 0],
                      ].map(([label, count]) => (
                        <button
                          key={label}
                          onClick={() => setFilter(label)}
                          className={filter === label ? "active" : ""}
                        >
                          {label} ({count})
                        </button>
                      ))}
                    </div>
                    <div className="table-scroll">
                      <table className="monitor-table">
                        <thead>
                          <tr>
                            <th>
                              Name <ChevronDown size={11} />
                            </th>
                            <th>Status</th>
                            <th>Uptime (24h)</th>
                            <th>Response Time</th>
                            <th>Last Check</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {loading && !data ? (
                            <tr>
                              <td colSpan="6" className="table-message">
                                Loading monitors…
                              </td>
                            </tr>
                          ) : filteredMonitors.length ? (
                            filteredMonitors.slice(0, 8).map((monitor) => (
                              <tr key={monitor.id}>
                                <td>
                                  <div className="monitor-name">
                                    <span className="monitor-symbol">
                                      <Globe2 size={15} />
                                    </span>
                                    <span>
                                      <b>{monitor.name}</b>
                                      <small>{shortUrl(monitor.url)}</small>
                                    </span>
                                  </div>
                                </td>
                                <td>
                                  <span
                                    className={`status-text ${statusLabel(monitor.status).toLowerCase()}`}
                                  >
                                    <i />
                                    {statusLabel(monitor.status)}
                                  </span>
                                </td>
                                <td>
                                  {monitor.uptimePercentage == null
                                    ? "—"
                                    : formatUptime(monitor.uptimePercentage)}
                                </td>
                                <td>
                                  {monitor.responseTime == null
                                    ? "—"
                                    : formatResponseTime(monitor.responseTime)}
                                </td>
                                <td>
                                  {monitor.checkedAt
                                    ? formatRelative(monitor.checkedAt)
                                    : "—"}
                                </td>
                                <td>
                                  <Link
                                    className="row-more"
                                    to={`/monitors/${monitor.id}`}
                                    aria-label={`Open ${monitor.name}`}
                                  >
                                    <ChevronRight size={15} />
                                  </Link>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan="6" className="table-message">
                                {monitors.length
                                  ? "No monitors match this filter."
                                  : "No monitors yet. Add your first monitor to start tracking uptime."}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </article>
                )}
                {dashboardPrefs?.widgets?.showRecentActivity !== false && (
                  <article className="panel">
                    <div className="panel-heading">
                      <div>
                        <h2>Recent Activity</h2>
                        <p>Latest changes across your account</p>
                      </div>
                      <Link className="view-all" to="/activity">
                        View all <ArrowRight size={14} />
                      </Link>
                    </div>
                    {recentActivities.length ? (
                      recentActivities.slice(0, 5).map((item) => (
                        <div
                          className="health-row"
                          key={item.id || item._id || item.createdAt}
                        >
                          <b>
                            {item.description ||
                              item.message ||
                              item.action ||
                              "Account activity"}
                          </b>
                          <small>
                            {formatRelative(item.createdAt || item.timestamp)}
                          </small>
                        </div>
                      ))
                    ) : (
                      <p className="muted-copy">No recent activity.</p>
                    )}
                  </article>
                )}
              </section>

              <aside className="dashboard-rail">
                {dashboardPrefs?.widgets?.showActiveIncidents !== false && (
                  <article className="panel incident-panel">
                    <div className="rail-title">
                      <span
                        className={
                          incidentCount ? "incident-dot" : "healthy-dot"
                        }
                      />{" "}
                      <b>
                        {incidentCount} Active{" "}
                        {incidentCount === 1 ? "Incident" : "Incidents"}
                      </b>
                      <Link to="/incidents" aria-label="View incidents">
                        <ChevronRight size={16} />
                      </Link>
                    </div>
                    {incidents.length ? (
                      incidents.slice(0, 1).map((incident) => (
                        <Link
                          className="incident-callout"
                          key={incident.id || incident._id}
                          to={`/incidents`}
                        >
                          <b>
                            {incident.monitorName ||
                              incident.monitor?.name ||
                              "Monitor issue"}
                          </b>
                          <span>
                            {incident.title ||
                              incident.message ||
                              "Website is not responding"}
                          </span>
                          <small>
                            {incident.startedAt
                              ? formatRelative(incident.startedAt)
                              : "Active now"}
                          </small>
                        </Link>
                      ))
                    ) : (
                      <div className="all-clear">
                        <ShieldCheck size={17} /> No active incidents
                      </div>
                    )}
                  </article>
                )}
                {dashboardPrefs?.widgets?.showQuickActions !== false && (
                  <article className="panel quick-panel">
                    <h2>Quick Actions</h2>
                    <Link to="/monitors" className="quick-action">
                      <span>
                        <Plus size={20} />
                      </span>
                      <b>Add Monitor</b>
                      <ChevronRight size={15} />
                    </Link>
                    <Link to="/insights" className="quick-action">
                      <span>
                        <FileText size={18} />
                      </span>
                      <b>View Reports</b>
                      <ChevronRight size={15} />
                    </Link>
                    <Link to="/incidents" className="quick-action">
                      <span>
                        <TriangleAlert size={18} />
                      </span>
                      <b>Check Incidents</b>
                      <ChevronRight size={15} />
                    </Link>
                  </article>
                )}
                <article className="panel health-panel">
                  <h2>System Health</h2>
                  {[
                    [
                      "API Server",
                      systemHealth?.status === "ok"
                        ? "Healthy"
                        : systemHealth
                          ? "Issues"
                          : "Checking",
                      systemHealth?.status === "ok",
                    ],
                    [
                      "Database",
                      systemHealth?.mongo === "connected"
                        ? "Healthy"
                        : systemHealth?.mongo || "Checking",
                      systemHealth?.mongo === "connected",
                    ],
                    ["Worker", "Not reported", null],
                  ].map(([label, state, healthy]) => (
                    <div className="health-row" key={label}>
                      <span
                        className={
                          healthy === null
                            ? "unknown-dot"
                            : healthy
                              ? "healthy-dot"
                              : "incident-dot"
                        }
                      />
                      <b>{label}</b>
                      <strong
                        className={healthy === null ? "unknown-health" : ""}
                      >
                        {state}
                      </strong>
                    </div>
                  ))}
                </article>
                <article className="insight-promo">
                  <span className="promo-icon">
                    <Activity size={19} />
                  </span>
                  <Sparkles className="promo-sparkle" size={17} />
                  <h2>Stay ahead of downtime</h2>
                  <p>
                    Get instant alerts and keep your websites running smoothly,
                    always.
                  </p>
                  <Link to="/insights">
                    View Insights <ArrowRight size={14} />
                  </Link>
                </article>
              </aside>
            </div>
          </main>
        </div>
      </div>
    </TranslateTree>
  );
}
