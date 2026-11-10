import { useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  useMonitorDetails,
  useMonitorMutations,
  useMonitorRegionalAnalytics,
} from "../hooks/useMonitors";
import { useMonitorSlos, useSloMutations } from "../hooks/useSlos";
import { useUsage } from "../hooks/useUsage";
import MonitorInsights from "../components/monitorDetails/MonitorInsights";
import { ROUTES, sloDetailsPath } from "../constants/routes";
import { formatRelative, formatUptime } from "../utils/format";
import { formatPercentage } from "../utils/sloFormat";
import SloStatusBadge from "../components/slo/SloStatusBadge";
import ErrorBudgetMeter from "../components/slo/ErrorBudgetMeter";
import SloFormModal from "../components/slo/SloFormModal";
import RegionalMonitoringFields from "../components/monitor/RegionalMonitoringFields";
import ApiMonitorFormFields from "../components/monitor/ApiMonitorFormFields";
import AssertionResultsDialog from "../components/monitorDetails/AssertionResultsDialog";
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
  Target,
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
  const [regionalMetric, setRegionalMetric] = useState("p95");
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [inspectedCheck, setInspectedCheck] = useState(null);
  const [apiConfigState, setApiConfigState] = useState(null);
  const [sloModalOpen, setSloModalOpen] = useState(false);

  const { data, loading, error, refetch } = useMonitorDetails(id, window);
  const { data: regionalResponse } = useMonitorRegionalAnalytics(id, window);
  const { data: monitorSlosRes, refetch: refetchMonitorSlos } =
    useMonitorSlos(id);
  const monitorSlos = monitorSlosRes?.data || [];
  const details = data?.data;
  const regionalData = regionalResponse?.data;

  const { data: usageData } = useUsage();
  const usage = usageData?.data;

  const { createSlo, submitting: creatingSlo } = useSloMutations(() => {
    setSloModalOpen(false);
    refetchMonitorSlos();
  });

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
      eyebrow={
        monitor.kind === "api" ? "API MONITOR DETAIL" : "WEBSITE MONITOR DETAIL"
      }
      title={
        <span className="flex items-center gap-2">
          {monitor.name || "Monitor"}
          {monitor.kind === "api" && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-purple-100 text-purple-700 uppercase">
              API: {monitor.apiConfig?.method || "GET"}
            </span>
          )}
        </span>
      }
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
            {
              key: "httpStatus",
              label: "HTTP code",
              render: (v, r) => v ?? r.statusCode ?? "—",
            },
            {
              key: "assertions",
              label: "Assertions",
              render: (_, row) => {
                if (
                  !row.assertionSummary &&
                  (!row.assertionResults || !row.assertionResults.length)
                ) {
                  return monitor.kind === "api" ? (
                    <span className="text-xs text-slate-400">None</span>
                  ) : (
                    "—"
                  );
                }
                const summary = row.assertionSummary || {
                  total: row.assertionResults.length,
                  passed: row.assertionResults.filter((a) => a.passed).length,
                  failed: row.assertionResults.filter(
                    (a) => a.outcome === "failed",
                  ).length,
                  errors: row.assertionResults.filter(
                    (a) => a.outcome === "error",
                  ).length,
                };
                const allPassed = summary.failed === 0 && summary.errors === 0;
                return (
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold ${
                        allPassed
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {summary.passed}/{summary.total} passed
                    </span>
                    <button
                      type="button"
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium underline"
                      onClick={() => setInspectedCheck(row)}
                    >
                      Inspect
                    </button>
                  </div>
                );
              },
            },
            {
              key: "errorMessage",
              label: "Details",
              render: (v, r) => r.failureReason || v || "—",
            },
          ]}
          rows={checks}
        />
      </Panel>
      {monitor.regionalMonitoring?.enabled && (
        <Panel
          title="Regional monitoring"
          subtitle="Independent probe results by location"
        >
          <div className="sw-metric-grid">
            {regionalData?.regions
              ?.filter((region) =>
                monitor.regionalMonitoring.regions.includes(region.regionId),
              )
              .map((region) => (
                <Metric
                  key={region.regionId}
                  label={`${region.region.name} · ${region.region.location}`}
                  value={region.currentStatus}
                  icon={Globe2}
                  note={
                    region.agentStatus === "unavailable"
                      ? "Probe agent unavailable"
                      : region.lastCheckedAt
                        ? `Last checked ${formatRelative(region.lastCheckedAt)}`
                        : "No probe result yet"
                  }
                  tone={
                    region.currentStatus === "up"
                      ? "green"
                      : region.currentStatus === "down"
                        ? "amber"
                        : "blue"
                  }
                />
              ))}
          </div>
          {regionalData?.regions?.some(
            (region) =>
              monitor.regionalMonitoring.regions.includes(region.regionId) &&
              region.performanceAlert?.status === "degraded",
          ) && (
            <Notice tone="warning">
              Sustained regional response-time degradation detected. See the
              regional performance settings and comparison below.
            </Notice>
          )}
          <div className="detail-chart-grid mt-5">
            <div>
              <label className="mb-2 flex items-center gap-2 text-sm">
                Regional response-time comparison
                <select
                  value={regionalMetric}
                  onChange={(event) => setRegionalMetric(event.target.value)}
                >
                  <option value="average">Average</option>
                  <option value="p50">P50</option>
                  <option value="p95">P95</option>
                  <option value="p99">P99</option>
                </select>
              </label>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={regionalData?.trend || []}>
                  <CartesianGrid stroke="#edf2f6" />
                  <XAxis dataKey="timestamp" tick={{ fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 9 }} />
                  <Tooltip />
                  {monitor.regionalMonitoring.regions.map((regionId, index) => (
                    <Line
                      key={regionId}
                      dataKey={`${regionId}.${regionalMetric}`}
                      name={
                        regionalData?.regions?.find(
                          (item) => item.regionId === regionId,
                        )?.region.name || regionId
                      }
                      stroke={
                        ["#2563eb", "#059669", "#7c3aed", "#c2410c"][index % 4]
                      }
                      dot={false}
                      connectNulls={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div>
              <h3>Recent regional checks</h3>
              <Table
                columns={[
                  {
                    key: "regionId",
                    label: "Region",
                    render: (regionId) =>
                      regionalData?.regions?.find(
                        (item) => item.regionId === regionId,
                      )?.region.name || regionId,
                  },
                  {
                    key: "status",
                    label: "Status",
                    render: (status) => <Status value={status} />,
                  },
                  {
                    key: "responseTime",
                    label: "Response",
                    render: (value) =>
                      value == null ? "—" : `${Math.round(value)} ms`,
                  },
                  {
                    key: "completedAt",
                    label: "Checked",
                    render: (value) => (value ? formatRelative(value) : "—"),
                  },
                ]}
                rows={(regionalData?.recentChecks || [])
                  .filter((check) =>
                    monitor.regionalMonitoring.regions.includes(check.regionId),
                  )
                  .slice(0, 12)}
              />
            </div>
          </div>
          {!regionalData && (
            <Notice tone="info">Loading regional probe data…</Notice>
          )}
        </Panel>
      )}
      <MonitorInsights
        monitorId={id}
        details={details}
        retentionDays={usage?.retention?.days}
      />
      <Panel
        title="Service Level Objectives & Error Budgets"
        subtitle="Configured reliability commitments and error budgets for this monitor"
        actions={
          <Button variant="secondary" onClick={() => setSloModalOpen(true)}>
            <Target size={14} /> Configure SLO
          </Button>
        }
      >
        {monitorSlos.length === 0 ? (
          <p className="text-xs text-slate-500 py-2">
            No SLOs configured for this monitor yet. Click &quot;Configure
            SLO&quot; to set an availability target and track error budgets.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
            {monitorSlos.map((slo) => {
              const snap = slo.latestSnapshot;
              return (
                <Link
                  key={slo.id || slo._id}
                  to={sloDetailsPath(slo.id || slo._id)}
                  className="p-4 rounded-xl border border-slate-200 hover:border-emerald-500 transition-colors bg-white shadow-sm block group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <b className="text-sm font-semibold text-slate-900 group-hover:text-emerald-600 transition-colors">
                      {slo.name}
                    </b>
                    <SloStatusBadge
                      enabled={slo.enabled}
                      sli={snap?.sliPercentage}
                      target={slo.target}
                      remainingBudgetSeconds={snap?.remainingBudgetSeconds}
                      allowedErrorBudgetSeconds={
                        snap?.allowedErrorBudgetSeconds
                      }
                      dataCoveragePct={snap?.dataCoveragePercentage}
                      alertStatus={slo.alertState?.status}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                    <span>
                      Target: <b>{formatPercentage(slo.target, 2)}</b>
                    </span>
                    <span>
                      Actual SLI:{" "}
                      <b className="text-slate-800">
                        {formatPercentage(snap?.sliPercentage, 2)}
                      </b>
                    </span>
                    <span>
                      Window: <b>{slo.window}</b>
                    </span>
                  </div>
                  <ErrorBudgetMeter
                    allowedErrorBudgetSeconds={snap?.allowedErrorBudgetSeconds}
                    remainingBudgetSeconds={snap?.remainingBudgetSeconds}
                    remainingBudgetPercentage={snap?.remainingBudgetPercentage}
                    compact={true}
                  />
                </Link>
              );
            })}
          </div>
        )}
      </Panel>
      <SloFormModal
        isOpen={sloModalOpen}
        onClose={() => setSloModalOpen(false)}
        onSubmit={createSlo}
        initialMonitorId={id}
        submitting={creatingSlo}
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
                  if (monitor.kind === "api") {
                    handleFormSubmit({
                      name: f.get("name"),
                      url: f.get("url"),
                      kind: "api",
                      interval: Number(f.get("interval")),
                      apiConfig: apiConfigState || monitor.apiConfig || {},
                    });
                  } else {
                    handleFormSubmit({
                      name: f.get("name"),
                      url: f.get("url"),
                      kind: "website",
                      interval: Number(f.get("interval")),
                      regionalMonitoring: {
                        enabled: f.get("regionalMonitoring.enabled") === "on",
                        regions: f.getAll("regionalMonitoring.regions"),
                      },
                      performanceAlerts: {
                        enabled: f.get("performanceAlerts.enabled") === "on",
                        ...(usage?.features?.performanceAlertConfig
                          ? {
                              sensitivity: f.get(
                                "performanceAlerts.sensitivity",
                              ),
                              ...(f.get("performanceAlerts.thresholdMultiplier")
                                ? {
                                    thresholdMultiplier: Number(
                                      f.get(
                                        "performanceAlerts.thresholdMultiplier",
                                      ),
                                    ),
                                  }
                                : {}),
                              consecutiveBreaches: Number(
                                f.get("performanceAlerts.consecutiveBreaches"),
                              ),
                              cooldownMinutes: Number(
                                f.get("performanceAlerts.cooldownMinutes"),
                              ),
                            }
                          : {}),
                      },
                    });
                  }
                }}
              >
                <Input
                  label="Monitor name"
                  name="name"
                  placeholder={
                    monitor.kind === "api"
                      ? "e.g. User Profile API"
                      : "e.g. My Website"
                  }
                  defaultValue={monitor.name}
                  required
                />
                <Input
                  label={monitor.kind === "api" ? "API URL" : "URL"}
                  name="url"
                  type="url"
                  placeholder={
                    monitor.kind === "api"
                      ? "https://api.example.com/v1/health"
                      : "https://example.com"
                  }
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
                {monitor.kind === "api" ? (
                  <ApiMonitorFormFields
                    initialConfig={monitor.apiConfig}
                    isEdit={true}
                    onChange={setApiConfigState}
                  />
                ) : (
                  <>
                    <RegionalMonitoringFields
                      usage={usage}
                      config={monitor.regionalMonitoring}
                    />
                    <fieldset className="settings-grid rounded-lg border p-3 md:col-span-2">
                      <legend>Performance degradation alerts</legend>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          name="performanceAlerts.enabled"
                          defaultChecked={
                            monitor.performanceAlerts?.enabled !== false
                          }
                        />{" "}
                        Enable sustained latency alerts
                      </label>
                      <Select
                        label="Sensitivity"
                        name="performanceAlerts.sensitivity"
                        defaultValue={
                          monitor.performanceAlerts?.sensitivity || "normal"
                        }
                        disabled={!usage?.features?.performanceAlertConfig}
                      >
                        <option value="low">Low · substantial changes</option>
                        <option value="normal">Normal · balanced</option>
                        <option value="high">High · smaller changes</option>
                      </Select>
                      <Input
                        label="Threshold multiplier (optional)"
                        name="performanceAlerts.thresholdMultiplier"
                        type="number"
                        min="1.1"
                        max="5"
                        step="0.1"
                        placeholder="Use sensitivity preset"
                        defaultValue={
                          monitor.performanceAlerts?.thresholdMultiplier ?? ""
                        }
                        disabled={!usage?.features?.performanceAlertConfig}
                      />
                      <Input
                        label="Consecutive breaches"
                        name="performanceAlerts.consecutiveBreaches"
                        type="number"
                        min="2"
                        max="10"
                        placeholder="e.g. 3"
                        defaultValue={
                          monitor.performanceAlerts?.consecutiveBreaches || 3
                        }
                        disabled={!usage?.features?.performanceAlertConfig}
                      />
                      <Input
                        label="Repeat cooldown (minutes)"
                        name="performanceAlerts.cooldownMinutes"
                        type="number"
                        min="5"
                        max="1440"
                        placeholder="e.g. 30"
                        defaultValue={
                          monitor.performanceAlerts?.cooldownMinutes || 30
                        }
                        disabled={!usage?.features?.performanceAlertConfig}
                      />
                      {!usage?.features?.performanceAlertConfig && (
                        <p className="text-sm text-slate-500 md:col-span-2">
                          Custom sensitivity is available on Pro and Enterprise.
                          Upgrade to configure it.
                        </p>
                      )}
                    </fieldset>
                  </>
                )}
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
      <AssertionResultsDialog
        open={Boolean(inspectedCheck)}
        onClose={() => setInspectedCheck(null)}
        check={inspectedCheck}
      />
    </Page>
  );
}
