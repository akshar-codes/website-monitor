import { useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  useSloDetails,
  useSloSnapshots,
  useSloMutations,
} from "../hooks/useSlos";
import { ROUTES, monitorDetailsPath } from "../constants/routes";
import { Page, Button, Notice } from "../components/ui/Primitives";
import SloStatusBadge from "../components/slo/SloStatusBadge";
import ErrorBudgetMeter from "../components/slo/ErrorBudgetMeter";
import BurnRateCard from "../components/slo/BurnRateCard";
import ExhaustionForecastCard from "../components/slo/ExhaustionForecastCard";
import SloAlertStatePanel from "../components/slo/SloAlertStatePanel";
import SloHistoryChart from "../components/slo/SloHistoryChart";
import SloFormModal from "../components/slo/SloFormModal";
import { formatPercentage, formatBudgetDuration } from "../utils/sloFormat";
import {
  formatDateTime,
  formatDuration,
  formatRelative,
} from "../utils/format";
import {
  ArrowLeft,
  RefreshCw,
  Pencil,
  Power,
  Trash2,
  ExternalLink,
  Target,
  Clock,
  Flame,
  Activity,
  Layers,
  Calendar,
} from "lucide-react";

export default function SloDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [editOpen, setEditOpen] = useState(false);
  const [snapshotsPage, setSnapshotsPage] = useState(1);
  const [evaluating, setEvaluating] = useState(false);

  // Fetch combined SLO details (SLO document + latest snapshot + alert state)
  const { data, loading, error, refetch } = useSloDetails(id);
  const slo = data?.slo;
  const snapshot = data?.snapshot;
  const alertState = data?.alertState;

  // Historical snapshots for chart and table
  const { data: snapshotsData, refetch: refetchSnapshots } = useSloSnapshots(
    id,
    {
      page: snapshotsPage,
      limit: 15,
    },
  );
  const snapshots = snapshotsData?.data || [];
  const snapshotsPagination = snapshotsData?.pagination;

  const handleMutationSuccess = useCallback(
    (action) => {
      if (action === "delete") {
        navigate(ROUTES.SLOS, { replace: true });
        return;
      }
      setEditOpen(false);
      refetch();
      refetchSnapshots();
    },
    [navigate, refetch, refetchSnapshots],
  );

  const { updateSlo, deleteSlo, toggleSlo, evaluateSlo, submitting } =
    useSloMutations(handleMutationSuccess);

  const handleEvaluateNow = async () => {
    setEvaluating(true);
    try {
      await evaluateSlo(id);
    } finally {
      setEvaluating(false);
    }
  };

  const handleToggle = () => {
    if (!slo) return;
    toggleSlo(id, !slo.enabled, slo.name);
  };

  const handleDelete = () => {
    if (!slo) return;
    if (window.confirm(`Are you sure you want to delete SLO "${slo.name}"?`)) {
      deleteSlo(id, slo.name);
    }
  };

  const handleFormSubmit = async (payload) => {
    await updateSlo(id, payload);
  };

  // Loading state
  if (loading && !data) {
    return (
      <Page
        title="Loading Service Level Objective..."
        description="Fetching evaluation snapshots and error budget telemetry."
      >
        <div className="space-y-4 max-w-5xl mx-auto my-6 animate-pulse">
          <div className="h-28 bg-slate-100 rounded-xl" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 bg-slate-100 rounded-xl" />
            ))}
          </div>
          <div className="h-64 bg-slate-100 rounded-xl" />
        </div>
      </Page>
    );
  }

  // Not found or error
  if (error || !slo) {
    return (
      <Page
        title="Objective Unavailable"
        description="This SLO could not be found or you do not have permission to access it."
        actions={
          <Button variant="secondary" onClick={() => navigate(ROUTES.SLOS)}>
            <ArrowLeft size={14} /> Back to SLOs
          </Button>
        }
      >
        <Notice tone="error">
          The requested SLO was not found or your session does not have
          authorization to view it.
        </Notice>
      </Page>
    );
  }

  const target = slo.target ?? 99.9;
  const sli = snapshot?.sliPercentage;
  const remainingSecs = snapshot?.remainingBudgetSeconds;
  const allowedSecs = snapshot?.allowedErrorBudgetSeconds;
  const consumedSecs = snapshot?.consumedBudgetSeconds;
  const remainingPct = snapshot?.remainingBudgetPercentage ?? 100;
  const consumptionPct = snapshot?.budgetConsumptionPercentage ?? 0;
  const coveragePct = snapshot?.dataCoveragePercentage ?? 100;
  const burnRates = snapshot?.burnRates || {};
  const forecast = snapshot?.exhaustionForecast || slo.lastExhaustionForecast;

  const thresholds = slo.alertSettings?.burnRateAlerts?.thresholds || [];
  const getThresholdForWindow = (win) =>
    thresholds.find((t) => t.window === win)?.rate;

  return (
    <Page
      eyebrow={
        <Link
          to={ROUTES.SLOS}
          className="inline-flex items-center gap-1 text-slate-500 hover:text-emerald-600 transition-colors"
        >
          <ArrowLeft size={12} /> ALL SERVICE LEVEL OBJECTIVES
        </Link>
      }
      title={
        <div className="flex flex-wrap items-center gap-3">
          <span>{slo.name}</span>
          <SloStatusBadge
            enabled={slo.enabled}
            sli={sli}
            target={target}
            remainingBudgetSeconds={remainingSecs}
            allowedErrorBudgetSeconds={allowedSecs}
            dataCoveragePct={coveragePct}
            alertStatus={alertState?.status}
          />
        </div>
      }
      description={
        slo.description ||
        `Availability target of ${target}% measured over a ${slo.window} rolling window.`
      }
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            onClick={handleEvaluateNow}
            disabled={evaluating || !slo.enabled}
            title="Calculate and persist a fresh evaluation snapshot"
          >
            <RefreshCw
              size={14}
              className={evaluating ? "animate-spin text-emerald-600" : ""}
            />
            <span>Evaluate Now</span>
          </Button>

          <Button
            variant="secondary"
            onClick={handleToggle}
            disabled={submitting}
            title={
              slo.enabled
                ? "Pause background evaluations"
                : "Resume background evaluations"
            }
          >
            <Power
              size={14}
              className={slo.enabled ? "text-amber-600" : "text-emerald-600"}
            />
            <span>{slo.enabled ? "Pause" : "Resume"}</span>
          </Button>

          <Button variant="secondary" onClick={() => setEditOpen(true)}>
            <Pencil size={14} /> Edit
          </Button>

          <Button
            variant="secondary"
            onClick={handleDelete}
            className="text-rose-600 hover:bg-rose-50"
          >
            <Trash2 size={14} /> Delete
          </Button>
        </div>
      }
    >
      {/* Target monitor link callout */}
      {slo.monitor && (
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs mb-6">
          <div className="flex items-center gap-2">
            <Activity className="text-emerald-600" size={16} />
            <span className="text-slate-500">Target Monitor:</span>
            <Link
              to={monitorDetailsPath(slo.monitor.id || slo.monitor._id)}
              className="font-semibold text-slate-800 hover:text-emerald-600 transition-colors flex items-center gap-1"
            >
              <span>{slo.monitor.name}</span>
              <ExternalLink size={12} />
            </Link>
            <span className="text-slate-400 font-mono">
              ({slo.monitor.url})
            </span>
          </div>

          <div className="flex items-center gap-4 text-slate-500">
            <span>
              Interval: <b>{slo.evaluationInterval} cadence</b>
            </span>
            <span>
              Rolling window: <b>{slo.window}</b>
            </span>
            <span>
              Last evaluated:{" "}
              <b>
                {snapshot?.windowEnd
                  ? formatRelative(snapshot.windowEnd)
                  : "Never"}
              </b>
            </span>
          </div>
        </div>
      )}

      {/* Warnings & Inadequate Coverage Alert */}
      {!slo.enabled && (
        <Notice tone="warn">
          <b>Evaluation Paused:</b> Background evaluation is disabled for this
          SLO. Metric values reflect the last snapshot captured before pausing.
        </Notice>
      )}

      {coveragePct < 50 && (
        <Notice tone="warn">
          <div className="space-y-1">
            <b>
              Insufficient Data Coverage ({formatPercentage(coveragePct, 1)}):
            </b>
            <p>
              Eligible observations represent less than 50% of the {slo.window}{" "}
              rolling window. Calculations are clamped to available monitor
              telemetry to prevent fabricated uptime.
            </p>
          </div>
        </Notice>
      )}

      {/* Key Metric Highlights */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
        <article className="sw-metric">
          <span
            className={`sw-metric-icon ${sli != null && sli >= target ? "green" : "red"}`}
          >
            <Target size={17} />
          </span>
          <span className="sw-metric-label">Actual SLI</span>
          <strong
            className={
              sli != null && sli >= target
                ? "text-emerald-600"
                : "text-rose-600"
            }
          >
            {sli != null ? formatPercentage(sli, 3) : "Pending"}
          </strong>
          <small>Target: {formatPercentage(target, 2)}</small>
        </article>

        <article className="sw-metric">
          <span
            className={`sw-metric-icon ${remainingSecs != null && remainingSecs > 0 ? "green" : "red"}`}
          >
            <Clock size={17} />
          </span>
          <span className="sw-metric-label">Budget Remaining</span>
          <strong
            className={
              remainingSecs != null && remainingSecs > 0
                ? "text-emerald-600"
                : "text-rose-600"
            }
          >
            {formatBudgetDuration(remainingSecs)}
          </strong>
          <small>{formatPercentage(remainingPct, 1)} of total budget</small>
        </article>

        <article className="sw-metric">
          <span className="sw-metric-icon yellow">
            <Flame size={17} />
          </span>
          <span className="sw-metric-label">Consumed Budget</span>
          <strong>{formatDuration(consumedSecs)}</strong>
          <small>{formatPercentage(consumptionPct, 1)} consumed</small>
        </article>

        <article className="sw-metric">
          <span className="sw-metric-icon green">
            <Layers size={17} />
          </span>
          <span className="sw-metric-label">Allowed Downtime</span>
          <strong>{formatDuration(allowedSecs)}</strong>
          <small>Total window budget</small>
        </article>

        <article className="sw-metric">
          <span
            className={`sw-metric-icon ${coveragePct >= 50 ? "green" : "yellow"}`}
          >
            <Activity size={17} />
          </span>
          <span className="sw-metric-label">Data Coverage</span>
          <strong>{formatPercentage(coveragePct, 1)}</strong>
          <small>
            {coveragePct >= 50 ? "Sufficient telemetry" : "Inadequate data"}
          </small>
        </article>
      </div>

      {/* Error Budget Visualization & Breakdown */}
      <div className="mb-6">
        <ErrorBudgetMeter
          allowedErrorBudgetSeconds={allowedSecs}
          consumedBudgetSeconds={consumedSecs}
          remainingBudgetSeconds={remainingSecs}
          remainingBudgetPercentage={remainingPct}
          budgetConsumptionPercentage={consumptionPct}
          goodDurationSeconds={snapshot?.goodDurationSeconds}
          badDurationSeconds={snapshot?.badDurationSeconds}
          unknownDurationSeconds={snapshot?.unknownDurationSeconds}
          maintenanceDurationSeconds={snapshot?.maintenanceDurationSeconds}
        />
      </div>

      {/* Burn-Rate Multi-Window Indicators */}
      <div className="space-y-3 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="text-rose-500" size={18} />
            <h3 className="text-base font-semibold text-slate-900">
              Multi-Window Burn-Rate Monitoring
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            Evaluates consumption acceleration across short, medium, and long
            lookbacks
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {["5m", "30m", "1h", "6h", "24h"].map((win) => {
            const data = burnRates[win] || {};
            return (
              <BurnRateCard
                key={win}
                window={win}
                rate={data.rate ?? 0}
                thresholdRate={getThresholdForWindow(win)}
                hasSufficientEvidence={data.hasSufficientEvidence ?? true}
                evidenceReason={data.evidenceReason}
                sampleCount={data.sampleCount ?? 0}
                eligibleDurationSeconds={data.eligibleDurationSeconds ?? 0}
                errorRatePercentage={data.errorRatePercentage ?? 0}
              />
            );
          })}
        </div>
      </div>

      {/* Exhaustion Forecast & Persistent Alert State Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <ExhaustionForecastCard forecast={forecast} />
        <SloAlertStatePanel alertState={alertState} />
      </div>

      {/* Historical Availability Trend Chart */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Calendar size={18} className="text-emerald-600" />
              <span>Availability History & Snapshots</span>
            </h3>
            <p className="text-xs text-slate-400">
              SLI percentage trend relative to the {target}% target threshold
            </p>
          </div>
          <span className="text-xs text-slate-500 font-mono">
            Target: {target}%
          </span>
        </div>

        <SloHistoryChart snapshots={snapshots} target={target} />
      </div>

      {/* Historical Snapshots Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900">
            Evaluation Snapshot Log
          </h3>
          <p className="text-xs text-slate-400">
            Deterministic audit record of historical calculations with bounded
            window horizons.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase text-slate-500 tracking-wider">
              <tr>
                <th className="py-3 px-4">Evaluation Timestamp</th>
                <th className="py-3 px-4">SLI Result</th>
                <th className="py-3 px-4">Remaining Budget</th>
                <th className="py-3 px-4">Consumed</th>
                <th className="py-3 px-4">Coverage</th>
                <th className="py-3 px-4">Version & Trigger</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {snapshots.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">
                    No snapshots persisted yet. Click "Evaluate Now" to generate
                    the first snapshot.
                  </td>
                </tr>
              ) : (
                snapshots.map((s) => (
                  <tr key={s.id || s._id} className="hover:bg-slate-50/60">
                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-800 block">
                        {formatDateTime(s.windowEnd || s.evaluatedAt)}
                      </span>
                      <small className="text-[10px] text-slate-400">
                        {formatRelative(s.windowEnd || s.evaluatedAt)}
                      </small>
                    </td>

                    <td className="py-3 px-4 font-mono font-bold">
                      <span
                        className={
                          s.sliPercentage >= target
                            ? "text-emerald-600"
                            : "text-rose-600"
                        }
                      >
                        {formatPercentage(s.sliPercentage, 3)}
                      </span>
                    </td>

                    <td className="py-3 px-4 font-mono">
                      <span
                        className={
                          s.remainingBudgetSeconds > 0
                            ? "text-emerald-600"
                            : "text-rose-600 font-bold"
                        }
                      >
                        {formatBudgetDuration(s.remainingBudgetSeconds)}
                      </span>
                      <span className="text-[10px] text-slate-400 ml-1">
                        ({formatPercentage(s.remainingBudgetPercentage, 1)})
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <span>
                        {formatPercentage(s.budgetConsumptionPercentage, 1)}
                      </span>
                      <small className="block text-[10px] text-slate-400">
                        {formatDuration(s.consumedBudgetSeconds)}
                      </small>
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={
                          s.dataCoveragePercentage < 50
                            ? "text-amber-600 font-semibold"
                            : "text-slate-600"
                        }
                      >
                        {formatPercentage(s.dataCoveragePercentage, 1)}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                      v{s.calculationVersion || 1} ·{" "}
                      {s.evaluationTrigger || "scheduled"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {snapshotsPagination && snapshotsPagination.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-xs text-slate-500">
            <span>
              Page {snapshotsPagination.page} of {snapshotsPagination.pages} (
              {snapshotsPagination.total} snapshots)
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setSnapshotsPage((p) => Math.max(1, p - 1))}
                disabled={snapshotsPage <= 1}
                className="px-2.5 py-1 rounded border border-slate-200 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                onClick={() =>
                  setSnapshotsPage((p) =>
                    Math.min(snapshotsPagination.pages, p + 1),
                  )
                }
                disabled={snapshotsPage >= snapshotsPagination.pages}
                className="px-2.5 py-1 rounded border border-slate-200 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit SLO Modal */}
      <SloFormModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        onSubmit={handleFormSubmit}
        initialData={slo}
        submitting={submitting}
      />
    </Page>
  );
}
