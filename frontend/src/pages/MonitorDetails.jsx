import { useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMonitorDetails, useMonitorMutations } from "../hooks/useMonitors";
import { useUsage } from "../hooks/useUsage";
import MonitorInsights from "../components/monitorDetails/MonitorInsights";
import { ROUTES } from "../constants/routes";
import { formatRelative, formatUptime } from "../utils/format";
import {
  Page,
  Panel,
  Button,
  Input,
  Select,
  Metric,
  Status,
  Table,
  Notice,
} from "../components/ui/Primitives";
import {
  ArrowLeft,
  ExternalLink,
  Pencil,
  Play,
  Pause,
  Trash2,
  RefreshCw,
  Globe2,
  Clock3,
  TriangleAlert,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
} from "recharts";

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

  const {
    updateMonitor,
    deleteMonitor,
    toggleMonitor,
    runMonitorCheck,
    submitting,
  } = useMonitorMutations(handleMutationSuccess);

  const handleFormSubmit = (payload) => {
    updateMonitor(id, payload);
  };

  // Full-page error — the monitor doesn't exist, isn't owned by the
  // caller, or the request failed outright with no cached data to show.
  if (loading && !data)
    return (
      <Page
        title="Loading monitor…"
        description="Fetching its latest health data."
      />
    );
  if (error || !details)
    return (
      <Page
        title="Monitor unavailable"
        description="This monitor could not be found or its details could not be loaded."
        actions={
          <Button variant="secondary" onClick={() => navigate(ROUTES.MONITORS)}>
            <ArrowLeft size={14} /> Back to monitors
          </Button>
        }
      >
        <Notice tone="error">
          Please check your connection or return to the monitor list.
        </Notice>
      </Page>
    );
  const monitor = details.monitor || {};
  const checks = details.recentChecks || [];
  const chartPoints = details.chart?.dataPoints || [];
  const chart = chartPoints.map((point) => ({
    day: new Date(point.timestamp).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: window === "24h" ? "numeric" : undefined,
    }),
    uptime: point.uptimePercentage,
    response: point.avgResponseTime,
  }));
  return (
    <Page
      eyebrow="MONITOR DETAIL"
      title={monitor.name || "Monitor"}
      description={monitor.url}
      actions={
        <>
          <a
            className="sw-button secondary"
            href={monitor.url}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink size={14} /> Open website
          </a>
          <Button
            variant="secondary"
            onClick={() => toggleMonitor(id, !monitor.active, monitor.name)}
            disabled={submitting}
          >
            {monitor.active ? <Pause size={14} /> : <Play size={14} />}{" "}
            {monitor.active ? "Pause" : "Resume"}
          </Button>
          <Button
            variant="secondary"
            onClick={() => runMonitorCheck(id)}
            disabled={submitting}
          >
            <RefreshCw size={14} /> Check now
          </Button>
          <Button variant="secondary" onClick={() => setEditOpen(true)}>
            <Pencil size={14} /> Edit
          </Button>
          <Button variant="danger" onClick={() => setDeleteOpen(true)}>
            <Trash2 size={14} /> Delete
          </Button>
        </>
      }
    >
      <div className="monitor-detail-status">
        <Status value={details.currentStatus} />
        <span>Last checked {formatRelative(details.lastCheckedAt)}</span>
        <span>Every {monitor.interval || "—"} seconds</span>
        {details.activeIncident && (
          <Link to="/incidents">
            View active incident <ArrowLeft size={13} />
          </Link>
        )}
      </div>
      <div className="sw-metric-grid">
        <Metric
          label="Uptime"
          value={
            details.uptime?.percentage == null
              ? "—"
              : formatUptime(details.uptime.percentage)
          }
          icon={Globe2}
          note={`${details.uptime?.totalChecks || 0} checks observed`}
        />
        <Metric
          label="Average response"
          value={`${Math.round(details.responseTime?.average || 0)} ms`}
          icon={Clock3}
          note={`Min ${details.responseTime?.min || 0} ms · Max ${details.responseTime?.max || 0} ms`}
          tone="blue"
        />
        <Metric
          label="Estimated downtime"
          value={`${Math.round((details.uptime?.estimatedDowntimeSeconds || 0) / 60)} min`}
          icon={TriangleAlert}
          tone="amber"
          note={`Coverage ${details.uptime?.coveragePercentage ?? 0}%`}
        />
        <Metric
          label="Failed checks"
          value={details.uptime?.failedChecks ?? 0}
          icon={TriangleAlert}
          tone={details.uptime?.failedChecks ? "red" : "green"}
          note={`Window ${window}`}
        />
      </div>
      <Panel
        title="Performance history"
        subtitle="Uptime and response trends"
        actions={
          <div className="segmented-control">
            {WINDOWS.map((w) => (
              <button
                className={window === w.value ? "active" : ""}
                key={w.value}
                onClick={() => setWindow(w.value)}
              >
                {w.label}
              </button>
            ))}
          </div>
        }
      >
        <div className="detail-chart-grid">
          <div>
            <h3>Uptime</h3>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chart}>
                <CartesianGrid stroke="#edf2f6" />
                <XAxis dataKey="day" tick={{ fontSize: 9 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 9 }} />
                <Tooltip />
                <Area
                  dataKey="uptime"
                  stroke="#08a879"
                  fill="#08a87920"
                  connectNulls={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div>
            <h3>Response time</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chart}>
                <CartesianGrid stroke="#edf2f6" />
                <XAxis dataKey="day" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 9 }} />
                <Tooltip />
                <Line dataKey="response" stroke="#3a8ddd" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        {!chart.length && (
          <div className="sw-empty">
            <b>No chart history for this period</b>
            <p>
              Check retention limits for your plan and come back after more
              checks.
            </p>
          </div>
        )}
      </Panel>
      <Panel title="Recent checks" subtitle="Latest health check results">
        <Table
          columns={[
            {
              key: "checkedAt",
              label: "Checked",
              render: (v) => (v ? new Date(v).toLocaleString() : "—"),
            },
            {
              key: "status",
              label: "Status",
              render: (v) => <Status value={v} />,
            },
            {
              key: "responseTime",
              label: "Response",
              render: (v) => (v == null ? "—" : `${v} ms`),
            },
            { key: "statusCode", label: "HTTP code" },
            { key: "errorMessage", label: "Details" },
          ]}
          rows={checks}
        />
      </Panel>
      <MonitorInsights
        monitorId={id}
        details={details}
        retentionDays={usage?.retention?.days}
      />
      {(editOpen || deleteOpen) && (
        <div className="modal-backdrop">
          <section className="form-modal">
            <h2>{editOpen ? "Edit monitor" : "Delete monitor?"}</h2>
            {editOpen ? (
              <form
                className="sw-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  handleFormSubmit({
                    name: f.get("name"),
                    url: f.get("url"),
                    interval: Number(f.get("interval")),
                  });
                }}
              >
                <Input
                  label="Monitor name"
                  name="name"
                  defaultValue={monitor.name}
                  required
                />
                <Input
                  label="URL"
                  name="url"
                  type="url"
                  defaultValue={monitor.url}
                  required
                />
                <Select
                  label="Interval"
                  name="interval"
                  defaultValue={monitor.interval}
                >
                  <option value="60">60 seconds</option>
                  <option value="300">300 seconds</option>
                  <option value="600">600 seconds</option>
                </Select>
                <div className="modal-actions">
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() => setEditOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button disabled={submitting}>Save changes</Button>
                </div>
              </form>
            ) : (
              <>
                <p className="muted-copy">
                  This will remove the monitor and its history.
                </p>
                <div className="modal-actions">
                  <Button
                    variant="secondary"
                    onClick={() => setDeleteOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    disabled={submitting}
                    onClick={() => deleteMonitor(id, monitor.name)}
                  >
                    Delete monitor
                  </Button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </Page>
  );
}
