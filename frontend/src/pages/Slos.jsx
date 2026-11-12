import { useState, useMemo, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSloList, useSloMutations } from "../hooks/useSlos";
import { useUsage } from "../hooks/useUsage";
import { usePermissions } from "../hooks/usePermissions";
import { FEATURES } from "../constants/features";
import {
  ROUTES,
  sloDetailsPath,
  monitorDetailsPath,
} from "../constants/routes";
import { Page, Button, Empty, Notice } from "../components/ui/Primitives";
import SloStatusBadge from "../components/slo/SloStatusBadge";
import ErrorBudgetMeter from "../components/slo/ErrorBudgetMeter";
import SloFormModal from "../components/slo/SloFormModal";
import { formatPercentage, formatBurnRate } from "../utils/sloFormat";
import {
  Target,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Pencil,
  Power,
  Flame,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
} from "lucide-react";

export default function Slos() {
  const navigate = useNavigate();
  const { hasFeature, loading: permLoading } = usePermissions();
  const hasSloFeature = hasFeature(FEATURES.SLO_MANAGEMENT);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editingSlo, setEditingSlo] = useState(null);
  const [evaluatingId, setEvaluatingId] = useState(null);

  const { data: usageData } = useUsage();
  const usage = usageData?.data;
  const sloUsage = usage?.slos;

  const queryParams = useMemo(() => {
    const params = { page, limit: 20 };
    if (statusFilter !== "all") params.status = statusFilter;
    return params;
  }, [page, statusFilter]);

  const { data: slosResponse, loading, refetch } = useSloList(queryParams);
  const slos = useMemo(() => slosResponse?.data || [], [slosResponse]);
  const pagination = slosResponse?.pagination;

  const handleMutationSuccess = useCallback(() => {
    setFormOpen(false);
    setEditingSlo(null);
    setEvaluatingId(null);
    refetch();
  }, [refetch]);

  const {
    createSlo,
    updateSlo,
    deleteSlo,
    toggleSlo,
    evaluateSlo,
    submitting,
  } = useSloMutations(handleMutationSuccess);

  // Client-side search filtering by name or monitor name
  const filteredSlos = useMemo(() => {
    if (!search.trim()) return slos;
    const q = search.toLowerCase();
    return slos.filter((slo) => {
      const matchName = slo.name?.toLowerCase().includes(q);
      const matchMonitor = slo.monitor?.name?.toLowerCase().includes(q);
      return matchName || matchMonitor;
    });
  }, [slos, search]);

  // Aggregate metric counts
  const metrics = useMemo(() => {
    let healthyCount = 0;
    let warningCount = 0;
    let breachedCount = 0;

    slos.forEach((s) => {
      const snap = s.latestSnapshot;
      const remaining = snap?.remainingBudgetSeconds;
      const sli = snap?.sliPercentage;
      if (s.enabled === false) return;
      if (remaining != null && remaining <= 0) {
        breachedCount++;
      } else if (sli != null && sli < s.target) {
        breachedCount++;
      } else if (snap?.budgetConsumptionPercentage >= 80) {
        warningCount++;
      } else {
        healthyCount++;
      }
    });

    return {
      total: slos.length,
      healthy: healthyCount,
      warning: warningCount,
      breached: breachedCount,
    };
  }, [slos]);

  const handleFormSubmit = async (payload) => {
    if (editingSlo) {
      await updateSlo(editingSlo.id || editingSlo._id, payload);
    } else {
      await createSlo(payload);
    }
  };

  const handleEvaluateClick = async (e, sloId) => {
    e.stopPropagation();
    setEvaluatingId(sloId);
    try {
      await evaluateSlo(sloId);
    } finally {
      setEvaluatingId(null);
    }
  };

  const handleToggleClick = (e, slo) => {
    e.stopPropagation();
    toggleSlo(slo.id || slo._id, !slo.enabled, slo.name);
  };

  const handleDeleteClick = (e, slo) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete SLO "${slo.name}"?`)) {
      deleteSlo(slo.id || slo._id, slo.name);
    }
  };

  // Plan gating banner if on Free tier
  if (!permLoading && !hasSloFeature) {
    return (
      <Page
        eyebrow="RELIABILITY & ERROR BUDGETS"
        title="Service Level Objectives"
        description="Monitor availability targets, multi-window burn rates, and error budgets."
      >
        <div className="bg-linear-to-br from-indigo-50 to-purple-50 border border-indigo-200 rounded-2xl p-8 max-w-4xl mx-auto my-8 shadow-sm text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-indigo-600 text-white flex items-center justify-center mx-auto shadow-md">
            <Target size={32} />
          </div>

          <div className="space-y-2 max-w-xl mx-auto">
            <h2 className="text-2xl font-bold text-slate-900">
              Upgrade to Pro for SLO & Error Budget Tracking
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Define precise reliability objectives (99.9%, 99.95%), track
              duration-weighted availability over rolling 30-day windows,
              monitor multi-lookback burn rates (14.4x, 6x, 2x), and forecast
              error budget depletion before outages breach SLA.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto text-left">
            <div className="p-4 rounded-xl bg-white/80 border border-slate-200/60">
              <ShieldCheck className="text-emerald-500 mb-2" size={20} />
              <b className="text-xs font-semibold text-slate-800 block">
                Duration-Weighted SLI
              </b>
              <p className="text-[11px] text-slate-500 mt-1">
                Calculates true service availability based on observation
                interval weights.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-white/80 border border-slate-200/60">
              <Flame className="text-rose-500 mb-2" size={20} />
              <b className="text-xs font-semibold text-slate-800 block">
                Burn-Rate Monitoring
              </b>
              <p className="text-[11px] text-slate-500 mt-1">
                Multi-window alerts catch brief severe spikes and slow
                persistent leaks.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-white/80 border border-slate-200/60">
              <Target className="text-indigo-500 mb-2" size={20} />
              <b className="text-xs font-semibold text-slate-800 block">
                Exhaustion Forecasting
              </b>
              <p className="text-[11px] text-slate-500 mt-1">
                Defensible mathematical projections estimate time until complete
                budget depletion.
              </p>
            </div>
          </div>

          <div className="pt-2">
            <Button
              variant="primary"
              onClick={() => navigate(ROUTES.BILLING)}
              className="inline-flex items-center gap-2"
            >
              <span>Explore Pro Plans</span>
              <ArrowRight size={14} />
            </Button>
          </div>
        </div>
      </Page>
    );
  }

  const isAtQuota = sloUsage?.atLimit;

  return (
    <Page
      eyebrow="RELIABILITY & ERROR BUDGETS"
      title="Service Level Objectives"
      description="Track availability targets, monitor error budget depletion, and detect burn rate anomalies."
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => refetch()}
            disabled={loading}
            aria-label="Refresh SLO list"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />{" "}
            Refresh
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              setEditingSlo(null);
              setFormOpen(true);
            }}
            disabled={isAtQuota}
            title={
              isAtQuota ? "SLO quota reached for your plan" : "Create new SLO"
            }
          >
            <Plus size={14} /> Create SLO
          </Button>
        </div>
      }
    >
      {/* Quota Banner if near or at limit */}
      {isAtQuota && (
        <Notice tone="warn">
          <div className="flex items-center justify-between w-full">
            <span>
              You have reached your limit of {sloUsage.limit} SLOs on your
              current plan.
            </span>
            <Link to={ROUTES.BILLING} className="font-semibold underline ml-2">
              Upgrade plan for higher limits
            </Link>
          </div>
        </Notice>
      )}

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <article className="sw-metric">
          <span className="sw-metric-icon green">
            <Target size={17} />
          </span>
          <span className="sw-metric-label">Total Objectives</span>
          <strong>{metrics.total}</strong>
          <small>
            {sloUsage?.limit
              ? `Quota: ${sloUsage.used}/${sloUsage.limit}`
              : "Active monitoring"}
          </small>
        </article>

        <article className="sw-metric">
          <span className="sw-metric-icon green">
            <ShieldCheck size={17} />
          </span>
          <span className="sw-metric-label">Healthy</span>
          <strong className="text-emerald-600">{metrics.healthy}</strong>
          <small>Meeting availability target</small>
        </article>

        <article className="sw-metric">
          <span className="sw-metric-icon yellow">
            <AlertTriangle size={17} />
          </span>
          <span className="sw-metric-label">At Risk</span>
          <strong className="text-amber-600">{metrics.warning}</strong>
          <small>&gt; 80% budget consumed</small>
        </article>

        <article className="sw-metric">
          <span className="sw-metric-icon red">
            <ShieldAlert size={17} />
          </span>
          <span className="sw-metric-label">Breached / Depleted</span>
          <strong className="text-rose-600">{metrics.breached}</strong>
          <small>Target breached or budget depleted</small>
        </article>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search
            className="absolute left-3 top-2.5 text-slate-400"
            size={15}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search objectives by name or monitor..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">All States</option>
            <option value="healthy">Healthy</option>
            <option value="warning">At Risk</option>
            <option value="breached">Breached</option>
            <option value="exhausted">Budget Exhausted</option>
            <option value="disabled">Disabled</option>
          </select>
        </div>
      </div>

      {/* Main Content Area */}
      {loading && slos.length === 0 ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 bg-slate-100 rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : filteredSlos.length === 0 ? (
        <Empty
          title={
            search ? "No matching objectives found" : "No SLOs configured yet"
          }
          action={
            !search && (
              <Button
                variant="primary"
                onClick={() => {
                  setEditingSlo(null);
                  setFormOpen(true);
                }}
                disabled={isAtQuota}
              >
                <Plus size={14} /> Create your first SLO
              </Button>
            )
          }
        >
          {search
            ? "Try adjusting your search query or status filter."
            : "Define an availability target (e.g. 99.9%) to track error budgets and receive early burn-rate alerts."}
        </Empty>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase text-slate-500 tracking-wider">
                <tr>
                  <th className="py-3 px-4">Objective & Monitor</th>
                  <th className="py-3 px-4">Target</th>
                  <th className="py-3 px-4">Current SLI</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 min-w-[180px]">Remaining Budget</th>
                  <th className="py-3 px-4">Window</th>
                  <th className="py-3 px-4">1h Burn</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSlos.map((slo) => {
                  const snap = slo.latestSnapshot;
                  const sli = snap?.sliPercentage;
                  const remainingSecs = snap?.remainingBudgetSeconds;
                  const allowedSecs = snap?.allowedErrorBudgetSeconds;
                  const remainingPct = snap?.remainingBudgetPercentage ?? 100;
                  const burnRates = snap?.burnRates || {};
                  const burn1h = burnRates["1h"]?.rate ?? 0;
                  const isEvaluating = evaluatingId === (slo.id || slo._id);

                  return (
                    <tr
                      key={slo.id || slo._id}
                      onClick={() =>
                        navigate(sloDetailsPath(slo.id || slo._id))
                      }
                      className="hover:bg-slate-50/70 transition-colors cursor-pointer group"
                    >
                      {/* Name & Monitor */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <span className="font-semibold text-slate-900 group-hover:text-emerald-600 flex items-center gap-1.5">
                            {slo.name}
                            {!slo.enabled && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-500 font-normal">
                                Disabled
                              </span>
                            )}
                          </span>
                          {slo.monitor && (
                            <Link
                              to={monitorDetailsPath(
                                slo.monitor.id || slo.monitor._id,
                              )}
                              onClick={(e) => e.stopPropagation()}
                              className="text-[11px] text-slate-400 hover:text-emerald-600 transition-colors block"
                            >
                              Monitor: {slo.monitor.name}
                            </Link>
                          )}
                        </div>
                      </td>

                      {/* Target */}
                      <td className="py-3.5 px-4 font-mono font-medium text-slate-700">
                        {formatPercentage(slo.target, 2)}
                      </td>

                      {/* Current SLI */}
                      <td className="py-3.5 px-4 font-mono font-bold">
                        {sli != null ? (
                          <span
                            className={
                              sli >= slo.target
                                ? "text-emerald-600"
                                : "text-rose-600"
                            }
                          >
                            {formatPercentage(sli, 2)}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-normal">
                            Pending
                          </span>
                        )}
                      </td>

                      {/* Status Badge */}
                      <td className="py-3.5 px-4">
                        <SloStatusBadge
                          enabled={slo.enabled}
                          sli={sli}
                          target={slo.target}
                          remainingBudgetSeconds={remainingSecs}
                          allowedErrorBudgetSeconds={allowedSecs}
                          dataCoveragePct={snap?.dataCoveragePercentage}
                          alertStatus={slo.alertState?.status}
                        />
                      </td>

                      {/* Remaining Budget Meter */}
                      <td className="py-3.5 px-4">
                        <ErrorBudgetMeter
                          allowedErrorBudgetSeconds={allowedSecs}
                          remainingBudgetSeconds={remainingSecs}
                          remainingBudgetPercentage={remainingPct}
                          compact={true}
                        />
                      </td>

                      {/* Window */}
                      <td className="py-3.5 px-4 text-slate-500">
                        {slo.window} rolling
                      </td>

                      {/* Burn Rate */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`font-mono text-xs font-semibold ${
                            burn1h > 1.0 ? "text-rose-600" : "text-slate-600"
                          }`}
                        >
                          {formatBurnRate(burn1h)}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div
                          className="flex items-center justify-end gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={(e) =>
                              handleEvaluateClick(e, slo.id || slo._id)
                            }
                            disabled={isEvaluating || !slo.enabled}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-slate-100 transition-colors disabled:opacity-40"
                            title="Evaluate on-demand now"
                            aria-label="Evaluate SLO"
                          >
                            <RefreshCw
                              size={14}
                              className={
                                isEvaluating
                                  ? "animate-spin text-emerald-600"
                                  : ""
                              }
                            />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingSlo(slo);
                              setFormOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                            title="Edit SLO"
                            aria-label="Edit SLO"
                          >
                            <Pencil size={14} />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => handleToggleClick(e, slo)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              slo.enabled
                                ? "text-slate-400 hover:text-amber-600"
                                : "text-emerald-600 hover:text-emerald-700 bg-emerald-50"
                            } hover:bg-slate-100`}
                            title={
                              slo.enabled
                                ? "Pause evaluation"
                                : "Enable evaluation"
                            }
                            aria-label={
                              slo.enabled ? "Pause SLO" : "Enable SLO"
                            }
                          >
                            <Power size={14} />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => handleDeleteClick(e, slo)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 transition-colors"
                            title="Delete SLO"
                            aria-label="Delete SLO"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination && pagination.pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-xs text-slate-500">
              <span>
                Showing page {pagination.page} of {pagination.pages} (
                {pagination.total} objectives)
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-2.5 py-1 rounded border border-slate-200 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  onClick={() =>
                    setPage((p) => Math.min(pagination.pages, p + 1))
                  }
                  disabled={page >= pagination.pages}
                  className="px-2.5 py-1 rounded border border-slate-200 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create / Edit Modal */}
      <SloFormModal
        isOpen={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingSlo(null);
        }}
        onSubmit={handleFormSubmit}
        initialData={editingSlo}
        submitting={submitting}
      />
    </Page>
  );
}
