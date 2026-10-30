import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAdminMonitor, useAdminMonitorCheck } from "../hooks/useAdmin";
import {
  Page,
  Panel,
  Button,
  Metric,
  Status,
  Table,
} from "../components/ui/Primitives";
import {
  RefreshCw,
  Activity,
  Clock3,
  UserRound,
  ArrowLeft,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { formatUptime } from "../utils/format";

export default function AdminMonitorDetails() {
  const { id } = useParams();
  const [window, setWindow] = useState("30d");
  const [confirm, setConfirm] = useState(false);
  const { data, loading, error, refetch } = useAdminMonitor(id, window);
  const { check, submitting } = useAdminMonitorCheck(() => {
    setConfirm(false);
    refetch();
  });
  const monitor = data?.monitor;
  const checks = data?.recentChecks || [];
  const points = [...checks].reverse().map((point) => ({
    ...point,
    time: point.checkedAt ? new Date(point.checkedAt).toLocaleString() : "",
  }));
  if (loading && !data)
    return (
      <Page title="Loading monitor…" description="Fetching platform details." />
    );
  if (error || !monitor)
    return (
      <Page
        title="Monitor unavailable"
        description="The monitor could not be loaded."
        actions={<Link to="/admin/monitors">Back to monitors</Link>}
      />
    );
  return (
    <Page
      eyebrow="ADMIN · MONITOR"
      title={monitor.name}
      description={monitor.url}
      actions={
        <>
          <Button variant="secondary" onClick={() => setWindow("7d")}>
            7 days
          </Button>
          <Button variant="secondary" onClick={() => setWindow("30d")}>
            30 days
          </Button>
          <Button disabled={submitting} onClick={() => setConfirm(true)}>
            <RefreshCw size={14} /> Run check
          </Button>
        </>
      }
    >
      <div className="detail-owner-line">
        <Status value={monitor.active ? "active" : "paused"} />
        <span>
          Owner: {monitor.owner?.name || monitor.owner?.email || "Unknown"}
        </span>
        <Link to={`/admin/users/${monitor.owner?.id}`}>
          <UserRound size={14} /> View account
        </Link>
        <Link className="text-link" to="/admin/monitors">
          <ArrowLeft size={13} /> All monitors
        </Link>
      </div>
      <div className="sw-metric-grid">
        <Metric
          label="Uptime"
          value={
            data.uptime?.uptimePercentage == null
              ? "—"
              : formatUptime(data.uptime.uptimePercentage)
          }
          icon={Activity}
          note={`${window} window`}
        />
        <Metric
          label="Average response"
          value={`${Math.round(data.uptime?.averageResponseTime || 0)} ms`}
          icon={Clock3}
          tone="blue"
        />
        <Metric
          label="Failed checks"
          value={data.uptime?.failedChecks ?? 0}
          icon={Activity}
          tone="red"
        />
        <Metric
          label="Check interval"
          value={`${monitor.interval || "—"}s`}
          icon={RefreshCw}
          tone="amber"
        />
      </div>
      <Panel
        title="Recent response history"
        subtitle={`Latest health checks · ${window}`}
      >
        {points.length ? (
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={points}>
              <CartesianGrid stroke="#edf2f6" />
              <XAxis dataKey="time" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 9 }} />
              <Tooltip />
              <Line
                dataKey="responseTime"
                name="Response time (ms)"
                stroke="#08a879"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="sw-empty">
            <b>No performance history</b>
          </div>
        )}
      </Panel>
      <Panel title="Recent check results">
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
            { key: "httpStatus", label: "HTTP status" },
            { key: "failureReason", label: "Failure reason" },
          ]}
          rows={checks}
        />
      </Panel>
      {confirm && (
        <div className="modal-backdrop">
          <section className="form-modal">
            <h2>Run a manual check?</h2>
            <p className="muted-copy">
              This sends a fresh health check to {monitor.name}.
            </p>
            <div className="modal-actions">
              <Button variant="secondary" onClick={() => setConfirm(false)}>
                Cancel
              </Button>
              <Button disabled={submitting} onClick={() => check(id)}>
                {submitting ? "Checking…" : "Run check"}
              </Button>
            </div>
          </section>
        </div>
      )}
    </Page>
  );
}
