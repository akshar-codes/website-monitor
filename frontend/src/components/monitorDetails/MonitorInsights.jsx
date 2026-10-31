import { useMemo, useState } from "react";
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
import { useQuery } from "../../hooks/useQuery";
import { useMonitorSsl, useSslMutations } from "../../hooks/useSsl";
import { usePermissions } from "../../hooks/usePermissions";
import * as monitorsApi from "../../services/api/monitors";
import { useMonitorAnalytics } from "../../hooks/useMonitors";
import { useTranslation, TranslateTree } from "../../i18n";
import {
  Button,
  Metric,
  Notice,
  Panel,
  Select,
  Status,
  Table,
} from "../ui/Primitives";
import {
  Activity,
  Clock3,
  Globe2,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";

const todayUtc = () => new Date().toISOString().slice(0, 10);

const shiftDate = (value, days) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const formatDate = (value) => (value ? new Date(value).toLocaleString() : "—");

const formatIncidentText = (value) =>
  String(value || "")
    .replace(/\b[a-z]+(?:_[a-z]+)+\b/gi, (code) => code.replaceAll("_", " "))
    .replace(/\s+/g, " ")
    .trim();

export default function MonitorInsights({ monitorId, details, retentionDays }) {
  const t = useTranslation();
  const { hasFeature } = usePermissions();
  const canInspectResponses = hasFeature("responseInspection");
  const sslResult = useMonitorSsl(monitorId);
  const sslData = sslResult.data?.data;
  const { triggerCheck, checking, updateSettings, updatingSettings } =
    useSslMutations(() => {
      sslResult.refetch();
    });
  const diagnosticsResult = useQuery(
    () => monitorsApi.getMonitorDiagnostics(monitorId),
    [monitorId],
    { immediate: !!monitorId },
  );
  const diagnostics = diagnosticsResult.data?.data;

  const availableRetention = Math.max(1, Number(retentionDays) || 1);
  const dateChoices = useMemo(() => {
    const presets = [
      { value: "24h", label: "Last 24 hours", days: 1 },
      { value: "7d", label: "Last 7 days", days: 7 },
      { value: "30d", label: "Last 30 days", days: 30 },
    ];
    return presets.filter((preset) => preset.days <= availableRetention);
  }, [availableRetention]);
  const [range, setRange] = useState("24h");
  const [customMode, setCustomMode] = useState(false);
  const [customStart, setCustomStart] = useState(todayUtc);
  const [customEnd, setCustomEnd] = useState(todayUtc);
  const [appliedCustomRange, setAppliedCustomRange] = useState({
    startDate: todayUtc(),
    endDate: todayUtc(),
  });
  const [rangeMessage, setRangeMessage] = useState("");
  const [latencySeries, setLatencySeries] = useState("p95ResponseTime");
  const earliestDate = shiftDate(todayUtc(), -(availableRetention - 1));
  const analyticsParams = customMode
    ? appliedCustomRange
    : {
        window: dateChoices.some((item) => item.value === range)
          ? range
          : "24h",
      };
  const analyticsResult = useMonitorAnalytics(monitorId, analyticsParams);
  const analytics = analyticsResult.data?.data;
  const analyticsChart = (analytics?.chart || []).map((point) => ({
    ...point,
    label: new Date(point.timestamp).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: analytics?.range?.granularity === "hourly" ? "numeric" : undefined,
    }),
  }));

  const applyCustomRange = (event) => {
    event.preventDefault();
    const start = new Date(`${customStart}T00:00:00.000Z`);
    const end = new Date(`${customEnd}T00:00:00.000Z`);
    const span = Math.floor((end - start) / 86400000) + 1;
    if (start > end) {
      setRangeMessage("Start date must be before or equal to end date.");
      return;
    }
    if (customStart < earliestDate || span > availableRetention) {
      setRangeMessage(`Your plan retains ${availableRetention} days of data.`);
      return;
    }
    if (customEnd > todayUtc()) {
      setRangeMessage("End date cannot be in the future.");
      return;
    }
    setRangeMessage("");
    setAppliedCustomRange({ startDate: customStart, endDate: customEnd });
  };

  const ssl = sslData?.ssl;
  const certificate = ssl?.certificate;
  const domain = ssl?.domain;
  const sslEnabled = sslData?.monitor?.sslMonitoringEnabled;
  const responseRows = (details?.recentChecks || []).filter(
    (check) => check.rawResponse != null,
  );
  const responseColumns = [
    { key: "checkedAt", label: "Checked", render: formatDate },
    {
      key: "status",
      label: "Status",
      render: (value) => <Status value={value} />,
    },
    { key: "httpStatus", label: "HTTP status" },
    {
      key: "rawResponse",
      label: "Response body",
      render: (value) => (
        <details className="monitor-response-details">
          <summary>{t("Inspect response")}</summary>
          <pre>{JSON.stringify(value, null, 2).slice(0, 4000)}</pre>
        </details>
      ),
    },
  ];

  return (
    <TranslateTree>
      <div className="monitor-insights-sections">
        {details?.activeIncident && (
          <Notice tone="error">
            <strong>Active incident · {details.activeIncident.severity}</strong>
            <span>
              {details.activeIncident.rootCause
                ? formatIncidentText(details.activeIncident.rootCause)
                : `This monitor has been in an incident since ${formatDate(details.activeIncident.startedAt)}.`}
            </span>
          </Notice>
        )}
        <Panel
          title="Monitor information"
          subtitle="Configuration and monitoring schedule"
        >
          <dl className="monitor-detail-facts">
            <div>
              <dt>Monitor name</dt>
              <dd>{details?.monitor?.name || "—"}</dd>
            </div>
            <div>
              <dt>URL</dt>
              <dd>{details?.monitor?.url || "—"}</dd>
            </div>
            <div>
              <dt>Check interval</dt>
              <dd>
                {details?.monitor?.interval
                  ? `${details.monitor.interval} seconds`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>{formatDate(details?.monitor?.createdAt)}</dd>
            </div>
            <div>
              <dt>Monitor status</dt>
              <dd>
                <Status
                  value={details?.monitor?.active ? "active" : "paused"}
                />
              </dd>
            </div>
          </dl>
        </Panel>
        <Panel
          title="SSL & domain"
          subtitle="Certificate health, expiry, and domain registration"
          actions={
            sslData?.eligible && (
              <div className="panel-actions">
                <Button
                  variant="secondary"
                  disabled={checking || !sslEnabled}
                  onClick={() => triggerCheck(monitorId)}
                >
                  <ShieldCheck size={14} />
                  {checking ? "Checking…" : "Check certificate"}
                </Button>
                <Button
                  variant="secondary"
                  disabled={updatingSettings}
                  onClick={() => updateSettings(monitorId, !sslEnabled)}
                >
                  {sslEnabled ? "Disable SSL checks" : "Enable SSL checks"}
                </Button>
              </div>
            )
          }
        >
          {sslResult.loading ? (
            <div className="sw-loading">Loading certificate data…</div>
          ) : sslData?.eligible === false ? (
            <Notice tone="info">
              SSL and domain checks require an HTTPS monitor.
            </Notice>
          ) : sslData ? (
            <>
              <div className="monitor-detail-status">
                <Status value={ssl?.status || "unknown"} />
                <span>
                  {ssl?.daysRemaining == null
                    ? "Certificate expiry unavailable"
                    : `${ssl.daysRemaining} days until certificate expiry`}
                </span>
                <span>Last checked {formatDate(ssl?.lastCheckedAt)}</span>
              </div>
              <dl className="monitor-detail-facts">
                <div>
                  <dt>Certificate issuer</dt>
                  <dd>{certificate?.issuer || "—"}</dd>
                </div>
                <div>
                  <dt>Valid until</dt>
                  <dd>{formatDate(certificate?.validTo)}</dd>
                </div>
                <div>
                  <dt>Protocol</dt>
                  <dd>{certificate?.protocol || "—"}</dd>
                </div>
                <div>
                  <dt>Domain registrar</dt>
                  <dd>{domain?.registrar || "—"}</dd>
                </div>
                <div>
                  <dt>Domain expires</dt>
                  <dd>{formatDate(domain?.expiresAt)}</dd>
                </div>
                <div>
                  <dt>Name servers</dt>
                  <dd>{domain?.nameServers?.join(", ") || "—"}</dd>
                </div>
              </dl>
              {ssl?.lastError && (
                <Notice tone="warning">{ssl.lastError}</Notice>
              )}
            </>
          ) : (
            <Notice tone="error">Could not load SSL and domain data.</Notice>
          )}
        </Panel>

        <Panel
          title="Diagnostics"
          subtitle="Latest HTTP, DNS, redirect, and security-header details"
        >
          {diagnosticsResult.loading ? (
            <div className="sw-loading">Loading diagnostics…</div>
          ) : diagnostics?.http ? (
            <>
              <div className="sw-metric-grid">
                <Metric
                  label="HTTP status"
                  value={diagnostics.http.status ?? "—"}
                  icon={Activity}
                />
                <Metric
                  label="Response time"
                  value={`${diagnostics.http.responseTimeMs ?? 0} ms`}
                  icon={Clock3}
                  tone="blue"
                />
                <Metric
                  label="DNS lookup"
                  value={`${diagnostics.dns?.durationMs ?? 0} ms`}
                  icon={Globe2}
                />
                <Metric
                  label="Redirects"
                  value={diagnostics.redirects?.length ?? 0}
                  icon={Activity}
                />
              </div>
              {diagnostics.http.failureReason && (
                <Notice tone="warning">{diagnostics.http.failureReason}</Notice>
              )}
              <h3 className="subsection-title">Security headers</h3>
              <Table
                columns={[
                  { key: "name", label: "Header" },
                  { key: "purpose", label: "Purpose" },
                  {
                    key: "present",
                    label: "Status",
                    render: (present) => (
                      <Status value={present ? "Present" : "Missing"} />
                    ),
                  },
                  {
                    key: "value",
                    label: "Value",
                    render: (value) => value || "—",
                  },
                ]}
                rows={diagnostics.securityHeaders || []}
              />
            </>
          ) : (
            <Notice tone="info">
              Diagnostics are available after the next health check.
            </Notice>
          )}
        </Panel>

        <Panel
          title="Response history"
          subtitle="Inspect recent response bodies returned by this endpoint"
        >
          {canInspectResponses ? (
            <Table
              columns={responseColumns}
              rows={responseRows}
              empty="No saved response bodies are available yet."
            />
          ) : (
            <Notice tone="info">
              Response inspection is available on Pro and above. Upgrade your
              plan to inspect the latest response bodies.
            </Notice>
          )}
        </Panel>

        <Panel
          title="Analytics & performance insights"
          subtitle="Compare uptime, response time, and availability over a selected range"
          actions={
            <Select
              aria-label={t("Analytics date range")}
              value={customMode ? "custom" : range}
              onChange={(event) => {
                if (event.target.value === "custom") {
                  setCustomMode(true);
                  setRangeMessage("");
                } else {
                  setCustomMode(false);
                  setRange(event.target.value);
                  setRangeMessage("");
                }
              }}
            >
              {dateChoices.map((choice) => (
                <option key={choice.value} value={choice.value}>
                  {choice.label}
                </option>
              ))}
              <option value="custom">Custom date range</option>
            </Select>
          }
        >
          {customMode && (
            <form
              className="settings-grid monitor-analytics-range"
              onSubmit={applyCustomRange}
            >
              <label className="sw-field">
                Start date
                <input
                  type="date"
                  min={earliestDate}
                  max={todayUtc()}
                  value={customStart}
                  onChange={(event) => setCustomStart(event.target.value)}
                />
              </label>
              <label className="sw-field">
                End date
                <input
                  type="date"
                  min={earliestDate}
                  max={todayUtc()}
                  value={customEnd}
                  onChange={(event) => setCustomEnd(event.target.value)}
                />
              </label>
              <Button>Apply range</Button>
              {rangeMessage && <Notice tone="warning">{rangeMessage}</Notice>}
            </form>
          )}
          {analyticsResult.loading ? (
            <div className="sw-loading">Loading analytics…</div>
          ) : analyticsResult.error ? (
            <Notice tone="warning">
              {analyticsResult.error.response?.data?.message ||
                "Could not load analytics for this range."}
            </Notice>
          ) : analytics ? (
            <>
              <div className="sw-metric-grid">
                <Metric
                  label="Uptime"
                  value={
                    analytics.overview?.uptimePercentage == null
                      ? "—"
                      : `${analytics.overview.uptimePercentage}%`
                  }
                  icon={ShieldCheck}
                />
                <Metric
                  label="Average response"
                  value={`${Math.round(analytics.overview?.avgResponseTime || 0)} ms`}
                  icon={Clock3}
                  tone="blue"
                />
                <Metric
                  label="P50 response"
                  value={
                    analytics.overview?.p50ResponseTime == null
                      ? "N/A"
                      : `${Math.round(analytics.overview.p50ResponseTime)} ms`
                  }
                  icon={Activity}
                  tone="blue"
                />
                <Metric
                  label="P95 response"
                  value={
                    analytics.overview?.responseTimeSampleCount
                      ? `${Math.round(analytics.overview.p95ResponseTime)} ms`
                      : "N/A"
                  }
                  icon={Activity}
                />
                <Metric
                  label="P99 response"
                  value={
                    analytics.overview?.p99ResponseTime == null
                      ? "N/A"
                      : `${Math.round(analytics.overview.p99ResponseTime)} ms`
                  }
                  icon={Activity}
                />
                <Metric
                  label="Failed checks"
                  value={analytics.overview?.failedChecks ?? 0}
                  icon={TriangleAlert}
                  tone="red"
                />
              </div>
              <div className="detail-chart-grid">
                <section>
                  <h3>Uptime trend</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={analyticsChart}>
                      <CartesianGrid stroke="#edf2f6" />
                      <XAxis dataKey="label" tick={{ fontSize: 9 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 9 }} />
                      <Tooltip />
                      <Area
                        dataKey="uptimePercentage"
                        name="Uptime (%)"
                        stroke="#08a879"
                        fill="#08a87920"
                        connectNulls={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </section>
                <section>
                  <div className="mb-2 flex items-center justify-between">
                    <h3>Response time trend</h3>
                    <Select
                      aria-label="Latency percentile"
                      value={latencySeries}
                      onChange={(event) => setLatencySeries(event.target.value)}
                    >
                      <option value="p50ResponseTime">P50</option>
                      <option value="p95ResponseTime">P95</option>
                      <option value="p99ResponseTime">P99</option>
                      <option value="avgResponseTime">Average</option>
                    </Select>
                  </div>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={analyticsChart}>
                      <CartesianGrid stroke="#edf2f6" />
                      <XAxis dataKey="label" tick={{ fontSize: 9 }} />
                      <YAxis tick={{ fontSize: 9 }} />
                      <Tooltip />
                      <Line
                        dataKey={latencySeries}
                        name={`${latencySeries.replace("ResponseTime", "").toUpperCase()} response time (ms)`}
                        stroke="#3a8ddd"
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </section>
              </div>
              <section className="mt-5">
                <h3 className="subsection-title">Network timing percentiles</h3>
                <p className="mb-3 text-sm text-slate-500">
                  Percentiles are histogram bucket estimates. Phase sample
                  counts include only checks with that measurement; unavailable
                  values are not treated as zero. TTFB includes connection setup
                  and should not be added to DNS/TCP/TLS.
                </p>
                <div className="sw-metric-grid">
                  {Object.entries(
                    analytics.overview?.latencyPercentiles?.timings || {},
                  ).map(([key, metric]) => {
                    const names = {
                      dns: "DNS lookup",
                      tcpConnect: "TCP connection",
                      tlsHandshake: "TLS handshake",
                      ttfb: "Time to first byte",
                    };
                    return (
                      <Metric
                        key={key}
                        label={`${names[key] || key} P50 / P95`}
                        value={
                          metric.sampleCount
                            ? `${metric.p50 ?? "N/A"} / ${metric.p95 ?? "N/A"} ms`
                            : "No samples"
                        }
                        icon={Clock3}
                        tone="blue"
                      />
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Response percentile sample count:{" "}
                  {analytics.overview?.responseTimeSampleCount || 0}
                </p>
              </section>
              <section className="mt-5">
                <h3 className="subsection-title">
                  Network phase timing trends (P95)
                </h3>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={analyticsChart}>
                    <CartesianGrid stroke="#edf2f6" />
                    <XAxis dataKey="label" tick={{ fontSize: 9 }} />
                    <YAxis tick={{ fontSize: 9 }} />
                    <Tooltip />
                    <Line
                      dataKey="phaseTimings.dns.p95"
                      name="DNS lookup"
                      stroke="#0f766e"
                      dot={false}
                      connectNulls={false}
                    />
                    <Line
                      dataKey="phaseTimings.tcpConnect.p95"
                      name="TCP connection"
                      stroke="#2563eb"
                      dot={false}
                      connectNulls={false}
                    />
                    <Line
                      dataKey="phaseTimings.tlsHandshake.p95"
                      name="TLS handshake"
                      stroke="#7c3aed"
                      dot={false}
                      connectNulls={false}
                    />
                    <Line
                      dataKey="phaseTimings.ttfb.p95"
                      name="Time to first byte"
                      stroke="#c2410c"
                      dot={false}
                      connectNulls={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </section>
              <section className="mt-5">
                <h3 className="subsection-title">Performance degradation</h3>
                {analytics.performanceAlert?.status === "degraded" ? (
                  <Notice tone="warning">
                    Sustained response-time degradation detected. Baseline
                    median:{" "}
                    {analytics.performanceAlert.baselineMedianMs == null
                      ? "warming up"
                      : `${Math.round(analytics.performanceAlert.baselineMedianMs)} ms`}{" "}
                    · consecutive breaches:{" "}
                    {analytics.performanceAlert.consecutiveBreaches}
                  </Notice>
                ) : (
                  <Notice tone="info">
                    {analytics.performanceAlert?.status === "disabled"
                      ? "Performance degradation alerts are disabled for this monitor."
                      : analytics.performanceAlert?.status === "warming_up"
                        ? "Collecting baseline samples. At least 20 scheduled HTTP samples are needed."
                        : "No active response-time anomaly."}
                  </Notice>
                )}
              </section>
              <h3 className="subsection-title">Component availability</h3>
              <div className="sw-metric-grid">
                <Metric
                  label="Frontend"
                  value={
                    analytics.availability?.frontend == null
                      ? "—"
                      : `${analytics.availability.frontend}%`
                  }
                  icon={Globe2}
                />
                <Metric
                  label="Backend"
                  value={
                    analytics.availability?.backend == null
                      ? "—"
                      : `${analytics.availability.backend}%`
                  }
                  icon={Activity}
                />
                <Metric
                  label="Database"
                  value={
                    analytics.availability?.database == null
                      ? "—"
                      : `${analytics.availability.database}%`
                  }
                  icon={Activity}
                />
                <Metric
                  label="Estimated downtime"
                  value={`${Math.round((analytics.overview?.estimatedDowntimeSeconds || 0) / 60)} min`}
                  icon={TriangleAlert}
                  tone="amber"
                />
              </div>
            </>
          ) : null}
        </Panel>
      </div>
    </TranslateTree>
  );
}
