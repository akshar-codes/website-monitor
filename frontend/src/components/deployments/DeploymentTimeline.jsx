import { useMemo } from "react";
import {
  Rocket,
  GitCommit,
  ExternalLink,
  Target,
  Info,
  RefreshCw,
  Server,
  Calendar,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import {
  getEnvironmentBadgeStyle,
  shortCommitSha,
} from "../../utils/deploymentFormat";
import { formatDateTime, formatRelative } from "../../utils/format";
import { Empty, Notice, Button } from "../ui/Primitives";

export default function DeploymentTimeline({
  deployments = [],
  loading = false,
  error = null,
  selectedDeployment = null,
  onSelectDeployment,
  onFocusChart,
  onInspectDeployment,
  environmentFilter = "all",
  onEnvironmentFilterChange,
  onRetry,
  window = "24h",
}) {
  // Extract distinct environments from the deployments list for filtering
  const distinctEnvironments = useMemo(() => {
    const envs = new Set();
    deployments.forEach((d) => {
      if (d.environment) envs.add(d.environment.toLowerCase());
    });
    return Array.from(envs);
  }, [deployments]);

  // Apply client-side filter if not already filtered by API
  const filteredDeployments = useMemo(() => {
    if (!environmentFilter || environmentFilter === "all") {
      return deployments;
    }
    return deployments.filter(
      (d) =>
        (d.environment || "").toLowerCase() === environmentFilter.toLowerCase(),
    );
  }, [deployments, environmentFilter]);

  if (loading && !deployments.length) {
    return (
      <div className="py-8 flex flex-col items-center justify-center text-xs text-slate-400 gap-2">
        <RefreshCw size={18} className="animate-spin text-slate-400" />
        <span>Loading deployment history...</span>
      </div>
    );
  }

  if (error && !deployments.length) {
    return (
      <div className="py-4">
        <Notice tone="error">
          <div className="flex items-center justify-between gap-4">
            <span>Unable to load deployment events for this monitor.</span>
            {onRetry && (
              <Button variant="secondary" onClick={onRetry}>
                Retry
              </Button>
            )}
          </div>
        </Notice>
      </div>
    );
  }

  return (
    <div
      className="deployment-timeline-container"
      data-testid="deployment-timeline"
    >
      {/* Top Controls: Filter by environment */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
            <Server size={13} /> Filter Environment:
          </span>
          <select
            value={environmentFilter}
            onChange={(e) => onEnvironmentFilterChange?.(e.target.value)}
            className="text-xs border border-slate-200 rounded-md px-2.5 py-1 bg-white text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
            data-testid="deployment-env-filter"
          >
            <option value="all">All environments</option>
            <option value="production">Production</option>
            <option value="staging">Staging</option>
            <option value="development">Development</option>
            {distinctEnvironments
              .filter(
                (env) =>
                  !["production", "staging", "development"].includes(env),
              )
              .map((env) => (
                <option key={env} value={env}>
                  {env}
                </option>
              ))}
          </select>
        </div>

        <div className="text-xs text-slate-400">
          Showing {filteredDeployments.length} release
          {filteredDeployments.length === 1 ? "" : "s"} in {window} window
        </div>
      </div>

      {/* Empty State */}
      {filteredDeployments.length === 0 ? (
        <div className="py-6">
          <Empty title="No deployments in this time window">
            {environmentFilter !== "all"
              ? `No ${environmentFilter} deployments were recorded for this monitor in the last ${window}.`
              : `No deployment events were reported for this monitor in the last ${window}. Connect your CI/CD pipeline using deployment integrations to track release correlation.`}
          </Empty>
        </div>
      ) : (
        /* Timeline Feed */
        <div className="relative pl-6 space-y-3 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
          {filteredDeployments.map((dep) => {
            const isSelected =
              selectedDeployment && selectedDeployment.id === dep.id;
            const envStyle = getEnvironmentBadgeStyle(dep.environment);
            const commit = shortCommitSha(dep.commitSha);

            return (
              <div
                key={dep.id}
                data-testid={`deployment-item-${dep.id}`}
                onClick={() => onSelectDeployment?.(dep)}
                className={`relative group p-3 rounded-lg border transition-all cursor-pointer ${
                  isSelected
                    ? "bg-indigo-50/60 border-indigo-400 ring-1 ring-indigo-400 shadow-sm"
                    : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
                }`}
              >
                {/* Timeline Dot Icon */}
                <span
                  className={`absolute left-[-1.95rem] top-3.5 flex items-center justify-center w-5 h-5 rounded-full border text-[10px] transition-colors ${
                    isSelected
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white text-slate-500 border-slate-300 group-hover:border-indigo-400 group-hover:text-indigo-600"
                  }`}
                  title={`Release ${dep.version}`}
                >
                  <Rocket size={11} />
                </span>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-xs text-slate-900 group-hover:text-indigo-600 transition-colors">
                      {dep.version}
                    </span>

                    <span
                      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${envStyle.badgeClass}`}
                    >
                      {envStyle.label}
                    </span>

                    {(dep.hasRegression ||
                      dep.regressionStatus === "suspected_regression") && (
                      <span
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 border border-red-200"
                        title={`Suspected regression: ${dep.regressionType || "performance degradation"}`}
                        data-testid="timeline-regression-badge"
                      >
                        <AlertTriangle size={10} className="text-red-600" />
                        Regression Suspected
                      </span>
                    )}

                    {dep.regressionStatus === "normal" && (
                      <span
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200"
                        title="No regression detected"
                      >
                        <CheckCircle2 size={10} className="text-emerald-600" />
                        Healthy
                      </span>
                    )}

                    {commit && (
                      <span
                        className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200"
                        title={`Commit SHA: ${dep.commitSha}`}
                      >
                        <GitCommit size={11} className="text-slate-400" />
                        {commit}
                      </span>
                    )}

                    {dep.source && (
                      <span className="text-[11px] text-slate-500 capitalize">
                        via {dep.source}
                      </span>
                    )}
                  </div>

                  {/* Actions & Timestamp */}
                  <div className="flex items-center gap-2 text-xs">
                    <span
                      className="text-slate-500 flex items-center gap-1 text-[11px]"
                      title={formatDateTime(dep.deployedAt)}
                    >
                      <Calendar size={11} className="text-slate-400" />
                      {formatRelative(dep.deployedAt)}
                    </span>

                    <div className="flex items-center gap-1 pl-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onFocusChart?.(dep);
                        }}
                        className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                        title="Focus on response time chart"
                        data-testid="focus-chart-button"
                      >
                        <Target size={13} />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onInspectDeployment?.(dep);
                        }}
                        className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                        title="Inspect release details"
                        data-testid="inspect-release-button"
                      >
                        <Info size={13} />
                      </button>

                      {dep.url && (
                        <a
                          href={dep.url}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                          title="Open external release link"
                        >
                          <ExternalLink size={13} />
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {dep.description && (
                  <p className="mt-1 text-xs text-slate-600 line-clamp-2">
                    {dep.description}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
