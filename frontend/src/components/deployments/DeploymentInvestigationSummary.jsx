import { useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  ExternalLink,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Activity,
  ShieldAlert,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import { formatRelative } from "../../utils/format";
import { Notice, Button } from "../ui/Primitives";
import { evaluateDeploymentRegression } from "../../services/api/deployments";

export default function DeploymentInvestigationSummary({
  deployment,
  impact,
  monitorId,
  onRefresh,
}) {
  const [evaluating, setEvaluating] = useState(false);
  const [evalMessage, setEvalMessage] = useState(null);

  if (!deployment || !impact) return null;

  const {
    window: win = {},
    metrics = {},
    correlation = {},
    relatedIncidents = [],
    alertState,
  } = impact;

  const { before = {}, after = {}, diff = {} } = metrics;
  const status = alertState?.status || correlation.status || "evaluating";
  const regressionType =
    alertState?.regressionType || correlation.regressionType || "combined";
  const evidence = alertState?.evidence?.length
    ? alertState.evidence
    : correlation.evidence || [];

  const postDeployIncidents = relatedIncidents.filter(
    (inc) => inc.timingRelation === "started_after_deployment",
  );

  const handleTriggerReevaluation = async () => {
    try {
      setEvaluating(true);
      setEvalMessage(null);
      await evaluateDeploymentRegression(
        monitorId,
        deployment.id || deployment._id,
        {
          windowMinutes: win.windowMinutes || 30,
        },
      );
      setEvalMessage({
        tone: "success",
        text: "Regression evaluation updated successfully.",
      });
      onRefresh?.();
    } catch (err) {
      setEvalMessage({
        tone: "error",
        text: err?.message || "Failed to trigger re-evaluation.",
      });
    } finally {
      setEvaluating(false);
    }
  };

  const getStatusBanner = () => {
    if (status === "suspected_regression") {
      return {
        containerClass: "bg-red-50/80 border-red-300 text-red-950",
        badgeClass: "bg-red-600 text-white",
        badgeText: "Suspected Regression",
        title: "Suspected Deployment Regression Detected",
        description: `Automated evaluation detected statistically significant degradation during the ${win.windowMinutes || 30}-minute post-release window.`,
        icon: <ShieldAlert size={20} className="text-red-600 shrink-0" />,
      };
    }
    if (status === "normal") {
      return {
        containerClass: "bg-emerald-50/80 border-emerald-300 text-emerald-950",
        badgeClass: "bg-emerald-600 text-white",
        badgeText: "Healthy Release",
        title: "No Regressions Detected",
        description: `Performance and availability remained within normal baseline variance during the ${win.windowMinutes || 30}-minute evaluation window.`,
        icon: (
          <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
        ),
      };
    }
    if (status === "insufficient_data") {
      return {
        containerClass: "bg-amber-50/80 border-amber-300 text-amber-950",
        badgeClass: "bg-amber-600 text-white",
        badgeText: "Insufficient Data",
        title: "Evaluation Withheld (Sparse History)",
        description:
          "Insufficient scheduled health checks were collected in this window. Comparisons are withheld to prevent false alarms.",
        icon: <HelpCircle size={20} className="text-amber-600 shrink-0" />,
      };
    }
    return {
      containerClass: "bg-indigo-50/80 border-indigo-300 text-indigo-950",
      badgeClass: "bg-indigo-600 text-white",
      badgeText: "Evaluating Window",
      title: "Evaluation In Progress",
      description: `Post-deployment window is active (${win.elapsedAfterMinutes || 0}m elapsed of ${win.windowMinutes || 30}m window). Samples are currently accumulating.`,
      icon: (
        <Activity
          size={20}
          className="text-indigo-600 shrink-0 animate-pulse"
        />
      ),
    };
  };

  const banner = getStatusBanner();

  return (
    <div
      className="deployment-investigation-summary space-y-4"
      data-testid="deployment-investigation-summary"
    >
      {/* Primary Investigation Banner */}
      <div className={`p-4 rounded-xl border ${banner.containerClass}`}>
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            {banner.icon}
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold tracking-wide uppercase ${banner.badgeClass}`}
                  data-testid="regression-status-badge"
                >
                  {banner.badgeText}
                </span>
                {status === "suspected_regression" && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-red-100 text-red-800 border border-red-200 capitalize">
                    Type: {regressionType.replace("_", " ")}
                  </span>
                )}
                {alertState?.alertDispatchedAt && (
                  <span className="text-[11px] text-slate-500">
                    Alert dispatched{" "}
                    {formatRelative(alertState.alertDispatchedAt)}
                  </span>
                )}
              </div>
              <h3 className="text-sm font-bold">{banner.title}</h3>
              <p className="text-xs opacity-90 mt-0.5 leading-relaxed">
                {banner.description}
              </p>
            </div>
          </div>

          <Button
            variant="secondary"
            disabled={evaluating}
            onClick={handleTriggerReevaluation}
            className="text-xs self-start"
            data-testid="reevaluate-regression-btn"
          >
            <RefreshCw
              size={12}
              className={`mr-1.5 ${evaluating ? "animate-spin" : ""}`}
            />
            {evaluating ? "Evaluating..." : "Re-evaluate"}
          </Button>
        </div>

        {evalMessage && (
          <div className="mt-3">
            <Notice tone={evalMessage.tone}>{evalMessage.text}</Notice>
          </div>
        )}

        {/* Empirical Evidence Details */}
        {evidence.length > 0 && (
          <div className="mt-3 pt-3 border-t border-current/15">
            <h4 className="text-xs font-bold mb-1.5 flex items-center gap-1.5">
              <AlertCircle size={13} />
              Observed Empirical Evidence:
            </h4>
            <ul className="space-y-1 text-xs">
              {evidence.map((item, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-1.5"
                  data-testid="regression-evidence-item"
                >
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-current shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Before / After Metrics Comparison Grid */}
      <div>
        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Activity size={13} className="text-indigo-600" />
          Comparative Telemetry ({win.windowMinutes || 30}m Before vs After)
        </h4>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
          {/* Median Response Time */}
          <div className="p-3 bg-white rounded-lg border border-slate-200">
            <span className="text-slate-500 block text-[11px] mb-1">
              Median Response Time
            </span>
            <div className="flex items-baseline gap-1.5 font-bold text-slate-800">
              <span>
                {before.medianResponseTime != null
                  ? `${before.medianResponseTime} ms`
                  : "—"}
              </span>
              <span className="text-slate-400 font-normal text-[10px]">→</span>
              <span
                className={
                  diff.medianResponseTimeChangeMs > 0
                    ? "text-amber-700"
                    : "text-emerald-700"
                }
              >
                {after.medianResponseTime != null
                  ? `${after.medianResponseTime} ms`
                  : "—"}
              </span>
            </div>
            {diff.medianResponseTimeChangePercent != null && (
              <span
                className={`inline-flex items-center gap-0.5 text-[10px] font-semibold mt-1 ${
                  diff.medianResponseTimeChangeMs > 0
                    ? "text-red-700"
                    : "text-emerald-700"
                }`}
              >
                {diff.medianResponseTimeChangeMs > 0 ? (
                  <TrendingUp size={10} />
                ) : (
                  <TrendingDown size={10} />
                )}
                {diff.medianResponseTimeChangeMs > 0 ? "+" : ""}
                {diff.medianResponseTimeChangeMs} ms (
                {diff.medianResponseTimeChangePercent > 0 ? "+" : ""}
                {diff.medianResponseTimeChangePercent}%)
              </span>
            )}
          </div>

          {/* P95 Response Time */}
          <div className="p-3 bg-white rounded-lg border border-slate-200">
            <span className="text-slate-500 block text-[11px] mb-1">
              P95 Response Time
            </span>
            <div className="flex items-baseline gap-1.5 font-bold text-slate-800">
              <span>
                {before.p95ResponseTime != null
                  ? `${before.p95ResponseTime} ms`
                  : "—"}
              </span>
              <span className="text-slate-400 font-normal text-[10px]">→</span>
              <span
                className={
                  diff.p95ResponseTimeChangeMs > 0
                    ? "text-amber-700"
                    : "text-emerald-700"
                }
              >
                {after.p95ResponseTime != null
                  ? `${after.p95ResponseTime} ms`
                  : "—"}
              </span>
            </div>
            {diff.p95ResponseTimeChangePercent != null && (
              <span
                className={`inline-flex items-center gap-0.5 text-[10px] font-semibold mt-1 ${
                  diff.p95ResponseTimeChangeMs > 0
                    ? "text-red-700"
                    : "text-emerald-700"
                }`}
              >
                {diff.p95ResponseTimeChangeMs > 0 ? (
                  <TrendingUp size={10} />
                ) : (
                  <TrendingDown size={10} />
                )}
                {diff.p95ResponseTimeChangeMs > 0 ? "+" : ""}
                {diff.p95ResponseTimeChangeMs} ms (
                {diff.p95ResponseTimeChangePercent > 0 ? "+" : ""}
                {diff.p95ResponseTimeChangePercent}%)
              </span>
            )}
          </div>

          {/* Availability */}
          <div className="p-3 bg-white rounded-lg border border-slate-200">
            <span className="text-slate-500 block text-[11px] mb-1">
              Availability
            </span>
            <div className="flex items-baseline gap-1.5 font-bold text-slate-800">
              <span>
                {before.availability != null ? `${before.availability}%` : "—"}
              </span>
              <span className="text-slate-400 font-normal text-[10px]">→</span>
              <span
                className={
                  diff.availabilityChange < 0
                    ? "text-red-700"
                    : "text-emerald-700"
                }
              >
                {after.availability != null ? `${after.availability}%` : "—"}
              </span>
            </div>
            {diff.availabilityChange != null && (
              <span
                className={`inline-flex items-center gap-0.5 text-[10px] font-semibold mt-1 ${
                  diff.availabilityChange < 0
                    ? "text-red-700"
                    : "text-emerald-700"
                }`}
              >
                {diff.availabilityChange < 0 ? (
                  <TrendingDown size={10} />
                ) : (
                  <TrendingUp size={10} />
                )}
                {diff.availabilityChange > 0 ? "+" : ""}
                {diff.availabilityChange}%
              </span>
            )}
          </div>

          {/* Sample Counts & Completeness */}
          <div className="p-3 bg-white rounded-lg border border-slate-200">
            <span className="text-slate-500 block text-[11px] mb-1">
              Sample Counts
            </span>
            <div className="flex items-baseline gap-1 font-bold text-slate-800">
              <span>{before.sampleCount ?? 0}</span>
              <span className="text-slate-400 font-normal text-[10px]">
                before /
              </span>
              <span>{after.sampleCount ?? 0}</span>
              <span className="text-slate-400 font-normal text-[10px]">
                after
              </span>
            </div>
            <span
              className={`inline-flex items-center text-[10px] font-semibold mt-1 ${
                before.hasSufficientSamples && after.hasSufficientSamples
                  ? "text-emerald-600"
                  : "text-amber-600"
              }`}
            >
              {before.hasSufficientSamples && after.hasSufficientSamples
                ? "✓ Statistically Sufficient"
                : "⚠ Sparse Sample History"}
            </span>
          </div>
        </div>
      </div>

      {/* Correlated Post-Deployment Incidents */}
      {postDeployIncidents.length > 0 && (
        <div className="p-3.5 bg-red-50/50 rounded-lg border border-red-200">
          <h4 className="text-xs font-bold text-red-900 mb-2 flex items-center gap-1.5">
            <AlertTriangle size={13} className="text-red-600" />
            Post-Deployment Incidents ({postDeployIncidents.length})
          </h4>
          <div className="space-y-2">
            {postDeployIncidents.map((inc) => (
              <div
                key={inc.id}
                className="p-2.5 bg-white rounded border border-red-100 flex items-center justify-between gap-3 text-xs"
                data-testid={`post-deploy-incident-${inc.id}`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900">
                      {inc.title}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                        inc.status === "resolved"
                          ? "bg-slate-100 text-slate-700"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {inc.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Started {formatRelative(inc.startedAt)} (
                    {Math.max(1, Math.round(inc.timeDeltaSeconds / 60))}m after
                    release)
                    {inc.duration &&
                      ` • Duration: ${Math.round(inc.duration / 60)}m`}
                  </div>
                </div>

                <Link
                  to={`/incidents?incidentId=${inc.id}`}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800"
                  data-testid="view-incident-link"
                >
                  Inspect Incident <ExternalLink size={11} />
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Explicit Causality vs Correlation Disclaimer */}
      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600">
        <div className="flex items-start gap-2">
          <Info size={14} className="text-slate-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong className="text-slate-700">
              Important Correlation Note:
            </strong>{" "}
            {alertState?.disclaimer ||
              "Temporal association detected. Performance changes or incidents occurred following release deployment. This indicates correlation, not proven causation. Manual verification is advised before rolling back."}
          </p>
        </div>
      </div>
    </div>
  );
}
