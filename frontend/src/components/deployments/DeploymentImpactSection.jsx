import { useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Clock,
  ExternalLink,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Activity,
  ShieldAlert,
} from "lucide-react";
import { useDeploymentImpact } from "../../hooks/useDeployments";
import { Status, Notice, Button } from "../ui/Primitives";

const INTERVAL_OPTIONS = [
  { label: "15m before & after", value: 15 },
  { label: "30m before & after (Default)", value: 30 },
  { label: "1h before & after", value: 60 },
  { label: "2h before & after", value: 120 },
];

export default function DeploymentImpactSection({ monitorId, deploymentId }) {
  const [windowMinutes, setWindowMinutes] = useState(30);

  const {
    data: impactData,
    loading,
    error,
    refetch,
  } = useDeploymentImpact(monitorId, deploymentId, { windowMinutes });

  if (loading && !impactData) {
    return (
      <div className="py-8 flex flex-col items-center justify-center text-xs text-slate-400 gap-2">
        <RefreshCw size={18} className="animate-spin text-slate-400" />
        <span>Calculating deployment impact and correlation metrics...</span>
      </div>
    );
  }

  if (error && !impactData) {
    return (
      <div className="py-4">
        <Notice tone="error">
          <div className="flex items-center justify-between gap-4">
            <span>
              Failed to load performance impact data for this release.
            </span>
            <Button variant="secondary" onClick={refetch}>
              Retry
            </Button>
          </div>
        </Notice>
      </div>
    );
  }

  const {
    window: win = {},
    metrics = {},
    correlation = {},
    relatedIncidents = [],
  } = impactData || {};

  const { before = {}, after = {}, diff = {} } = metrics;
  const status = correlation.status || "insufficient_data";
  const evidence = correlation.evidence || [];

  return (
    <div
      className="deployment-impact-section space-y-4"
      data-testid="deployment-impact-section"
    >
      {/* Interval Selector Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100 text-xs">
        <div className="flex items-center gap-1.5 text-slate-600 font-semibold">
          <Clock size={13} /> Comparison Window:
        </div>
        <select
          value={windowMinutes}
          onChange={(e) => setWindowMinutes(Number(e.target.value))}
          className="text-xs border border-slate-200 rounded px-2.5 py-1 bg-white text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
          data-testid="impact-window-select"
        >
          {INTERVAL_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Regression & Correlation Status Banner */}
      <div
        className={`p-3.5 rounded-lg border text-xs ${
          status === "suspected_regression"
            ? "bg-red-50/70 border-red-200 text-red-900"
            : status === "normal"
              ? "bg-emerald-50/70 border-emerald-200 text-emerald-900"
              : "bg-slate-50 border-slate-200 text-slate-800"
        }`}
        data-testid="impact-status-banner"
      >
        <div className="flex items-center gap-2 font-bold mb-1.5">
          {status === "suspected_regression" ? (
            <>
              <AlertTriangle size={15} className="text-red-600 flex-shrink-0" />
              <span>Suspected Performance Regression</span>
            </>
          ) : status === "normal" ? (
            <>
              <CheckCircle2
                size={15}
                className="text-emerald-600 flex-shrink-0"
              />
              <span>Stable Performance (No Regressions Detected)</span>
            </>
          ) : (
            <>
              <Info size={15} className="text-slate-500 flex-shrink-0" />
              <span>Insufficient Comparison Data</span>
            </>
          )}
        </div>

        {evidence.length > 0 && (
          <ul className="list-disc pl-4 space-y-1 mt-1 text-[11px] leading-relaxed">
            {evidence.map((ev, i) => (
              <li key={i}>{ev}</li>
            ))}
          </ul>
        )}

        {win.isWindowIncomplete && (
          <div className="mt-2 text-[10px] text-slate-500 italic flex items-center gap-1">
            <Clock size={10} /> Note: Post-deployment window is currently active
            ({win.elapsedAfterMinutes} of {win.windowMinutes} minutes elapsed).
          </div>
        )}
      </div>

      {/* Before / After Metrics Comparison Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
        {/* Availability */}
        <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-2xs">
          <span className="text-[11px] text-slate-500 block mb-1">
            Availability
          </span>
          <div className="font-semibold text-slate-900">
            {before.availability != null ? `${before.availability}%` : "—"} →{" "}
            {after.availability != null ? `${after.availability}%` : "—"}
          </div>
          {diff.availabilityChange != null && (
            <div
              className={`text-[11px] font-medium flex items-center gap-0.5 mt-0.5 ${
                diff.availabilityChange < 0
                  ? "text-red-600"
                  : diff.availabilityChange > 0
                    ? "text-emerald-600"
                    : "text-slate-500"
              }`}
            >
              {diff.availabilityChange < 0 ? (
                <TrendingDown size={11} />
              ) : diff.availabilityChange > 0 ? (
                <TrendingUp size={11} />
              ) : null}
              {diff.availabilityChange > 0
                ? `+${diff.availabilityChange}%`
                : `${diff.availabilityChange}%`}
            </div>
          )}
        </div>

        {/* Failure Rate */}
        <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-2xs">
          <span className="text-[11px] text-slate-500 block mb-1">
            Failure Rate
          </span>
          <div className="font-semibold text-slate-900">
            {before.failureRate != null ? `${before.failureRate}%` : "—"} →{" "}
            {after.failureRate != null ? `${after.failureRate}%` : "—"}
          </div>
          {diff.failureRateChange != null && (
            <div
              className={`text-[11px] font-medium flex items-center gap-0.5 mt-0.5 ${
                diff.failureRateChange > 0
                  ? "text-red-600"
                  : diff.failureRateChange < 0
                    ? "text-emerald-600"
                    : "text-slate-500"
              }`}
            >
              {diff.failureRateChange > 0 ? (
                <TrendingUp size={11} />
              ) : diff.failureRateChange < 0 ? (
                <TrendingDown size={11} />
              ) : null}
              {diff.failureRateChange > 0
                ? `+${diff.failureRateChange}%`
                : `${diff.failureRateChange}%`}
            </div>
          )}
        </div>

        {/* Median Latency */}
        <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-2xs">
          <span className="text-[11px] text-slate-500 block mb-1">
            Median Response
          </span>
          <div className="font-semibold text-slate-900">
            {before.medianResponseTime != null
              ? `${Math.round(before.medianResponseTime)} ms`
              : "—"}{" "}
            →{" "}
            {after.medianResponseTime != null
              ? `${Math.round(after.medianResponseTime)} ms`
              : "—"}
          </div>
          {diff.medianResponseTimeChangeMs != null && (
            <div
              className={`text-[11px] font-medium flex items-center gap-0.5 mt-0.5 ${
                diff.medianResponseTimeChangeMs > 15
                  ? "text-amber-600"
                  : diff.medianResponseTimeChangeMs < -15
                    ? "text-emerald-600"
                    : "text-slate-500"
              }`}
            >
              {diff.medianResponseTimeChangeMs > 0
                ? `+${Math.round(diff.medianResponseTimeChangeMs)} ms`
                : `${Math.round(diff.medianResponseTimeChangeMs)} ms`}
              {diff.medianResponseTimeChangePercent != null &&
                ` (${diff.medianResponseTimeChangePercent > 0 ? "+" : ""}${diff.medianResponseTimeChangePercent}%)`}
            </div>
          )}
        </div>

        {/* P95 Latency */}
        <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-2xs">
          <span className="text-[11px] text-slate-500 block mb-1">
            P95 Latency
          </span>
          <div className="font-semibold text-slate-900">
            {before.p95ResponseTime != null
              ? `${Math.round(before.p95ResponseTime)} ms`
              : "—"}{" "}
            →{" "}
            {after.p95ResponseTime != null
              ? `${Math.round(after.p95ResponseTime)} ms`
              : "—"}
          </div>
          {diff.p95ResponseTimeChangeMs != null && (
            <div
              className={`text-[11px] font-medium flex items-center gap-0.5 mt-0.5 ${
                diff.p95ResponseTimeChangeMs > 25
                  ? "text-amber-600"
                  : diff.p95ResponseTimeChangeMs < -25
                    ? "text-emerald-600"
                    : "text-slate-500"
              }`}
            >
              {diff.p95ResponseTimeChangeMs > 0
                ? `+${Math.round(diff.p95ResponseTimeChangeMs)} ms`
                : `${Math.round(diff.p95ResponseTimeChangeMs)} ms`}
              {diff.p95ResponseTimeChangePercent != null &&
                ` (${diff.p95ResponseTimeChangePercent > 0 ? "+" : ""}${diff.p95ResponseTimeChangePercent}%)`}
            </div>
          )}
        </div>
      </div>

      {/* Sample Counts Summary */}
      <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-md flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
        <span className="flex items-center gap-1.5 font-medium">
          <Activity size={12} className="text-slate-400" />
          Scheduled Samples:
        </span>
        <div className="flex items-center gap-4">
          <span>
            Before: <b>{before.sampleCount ?? 0}</b> checks (
            {before.successfulChecks ?? 0} up / {before.failedChecks ?? 0}{" "}
            failed)
          </span>
          <span>
            After: <b>{after.sampleCount ?? 0}</b> checks (
            {after.successfulChecks ?? 0} up / {after.failedChecks ?? 0} failed)
          </span>
        </div>
      </div>

      {/* Temporally Related Incidents */}
      <div className="pt-2">
        <div className="flex items-center gap-1.5 font-semibold text-xs text-slate-800 mb-2">
          <ShieldAlert size={14} className="text-slate-500" />
          <span>Correlated Monitor Incidents ({relatedIncidents.length})</span>
        </div>

        {relatedIncidents.length === 0 ? (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-500">
            No incidents recorded for this monitor within the comparison window.
          </div>
        ) : (
          <div className="space-y-2">
            {relatedIncidents.map((inc) => (
              <div
                key={inc.id}
                className="p-2.5 bg-white border border-slate-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs shadow-2xs"
              >
                <div className="flex items-center gap-2">
                  <Status value={inc.status} />
                  <span className="font-semibold text-slate-900">
                    {inc.title}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                      inc.severity === "critical"
                        ? "bg-red-100 text-red-800"
                        : inc.severity === "major"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {inc.severity}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-slate-500 text-[11px]">
                  <span>
                    {inc.timingRelation === "started_after_deployment" ? (
                      <span className="text-red-600 font-medium">
                        Started{" "}
                        {Math.round(Math.abs(inc.timeDeltaSeconds) / 60)}m after
                        release
                      </span>
                    ) : inc.timingRelation === "ongoing_during_deployment" ? (
                      <span className="text-amber-600 font-medium">
                        Ongoing during release
                      </span>
                    ) : (
                      <span>Resolved before release</span>
                    )}
                  </span>
                  <Link
                    to={`/incidents?search=${inc.id}`}
                    className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    View incident <ExternalLink size={11} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
