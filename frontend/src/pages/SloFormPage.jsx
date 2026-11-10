import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useSloMutations } from "../hooks/useSlos";
import * as slosApi from "../services/api/slos";
import * as monitorsApi from "../services/api/monitors";
import { ROUTES, sloDetailsPath } from "../constants/routes";
import { Page, Button } from "../components/ui/Primitives";
import {
  SLO_WINDOWS,
  EVALUATION_INTERVALS,
  TARGET_PRESETS,
  calculateAllowableDowntime,
} from "../../src/utils/sloFormat";
import {
  ArrowLeft,
  Sparkles,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

export default function SloFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const [loading, setLoading] = useState(isEditing);
  const [monitors, setMonitors] = useState([]);
  const [loadingMonitors, setLoadingMonitors] = useState(true);
  const [showAdvancedAlerts, setShowAdvancedAlerts] = useState(false);

  // Form fields
  const [monitorId, setMonitorId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [target, setTarget] = useState(99.9);
  const [window, setWindow] = useState("30d");
  const [evaluationInterval, setEvaluationInterval] = useState("5m");
  const [enabled, setEnabled] = useState(true);

  // Alert settings
  const [burnRateAlertsEnabled, setBurnRateAlertsEnabled] = useState(true);
  const [burn5mThreshold, setBurn5mThreshold] = useState(14.4);
  const [burn30mThreshold, setBurn30mThreshold] = useState(6.0);
  const [burn6hThreshold, setBurn6hThreshold] = useState(2.0);
  const [budgetWarningThreshold, setBudgetWarningThreshold] = useState(80);
  const [budgetExhaustedAlert, setBudgetExhaustedAlert] = useState(true);
  const [cooldownMinutes, setCooldownMinutes] = useState(60);

  const [formError, setFormError] = useState("");

  const handleMutationSuccess = (action, result) => {
    const targetId = result?._id || result?.id || id;
    if (targetId) {
      navigate(sloDetailsPath(targetId));
    } else {
      navigate(ROUTES.SLOS);
    }
  };

  const { createSlo, updateSlo, submitting } = useSloMutations(
    handleMutationSuccess,
  );

  // Load monitors
  useEffect(() => {
    let active = true;
    monitorsApi
      .getMonitors({ limit: 100 })
      .then((res) => {
        if (!active) return;
        const list = res?.data || [];
        setMonitors(list);
        if (!isEditing && list.length > 0) {
          setMonitorId((curr) => curr || list[0].id || list[0]._id);
          setName((curr) => curr || `${list[0].name} 99.9% Availability`);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoadingMonitors(false);
      });

    return () => {
      active = false;
    };
  }, [isEditing]);

  // Load existing SLO if editing
  useEffect(() => {
    if (!isEditing) return;
    let active = true;
    slosApi
      .getSloById(id)
      .then((slo) => {
        if (!active || !slo) return;
        setMonitorId(slo.monitor?._id || slo.monitor?.id || slo.monitor || "");
        setName(slo.name || "");
        setDescription(slo.description || "");
        setTarget(slo.target ?? 99.9);
        setWindow(slo.window || "30d");
        setEvaluationInterval(slo.evaluationInterval || "5m");
        setEnabled(slo.enabled ?? true);

        setBurnRateAlertsEnabled(
          slo.alertSettings?.burnRateAlerts?.enabled ?? true,
        );
        const thresholds = slo.alertSettings?.burnRateAlerts?.thresholds || [];
        const t5m = thresholds.find((t) => t.window === "5m");
        const t30m = thresholds.find((t) => t.window === "30m");
        const t6h = thresholds.find((t) => t.window === "6h");
        if (t5m) setBurn5mThreshold(t5m.rate);
        if (t30m) setBurn30mThreshold(t30m.rate);
        if (t6h) setBurn6hThreshold(t6h.rate);

        setBudgetWarningThreshold(
          slo.alertSettings?.budgetWarningThreshold ?? 80,
        );
        setBudgetExhaustedAlert(
          slo.alertSettings?.budgetExhaustedAlert ?? true,
        );
        setCooldownMinutes(slo.alertSettings?.cooldownMinutes ?? 60);
      })
      .catch((err) => {
        if (active)
          setFormError(
            err.response?.data?.message || "Failed to load SLO details",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id, isEditing]);

  const handleMonitorChange = (e) => {
    const nextId = e.target.value;
    setMonitorId(nextId);
    if (!isEditing) {
      const selectedMon = monitors.find((m) => (m.id || m._id) === nextId);
      if (selectedMon) {
        setName(`${selectedMon.name} 99.9% Availability`);
      }
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError("");

    if (!monitorId) {
      setFormError("Please select a target monitor.");
      return;
    }
    if (!name.trim()) {
      setFormError("SLO name is required.");
      return;
    }
    const numTarget = Number(target);
    if (isNaN(numTarget) || numTarget < 50 || numTarget >= 100) {
      setFormError("Target must be a percentage between 50% and 99.999%.");
      return;
    }

    const payload = {
      monitorId,
      name: name.trim(),
      description: description.trim() || undefined,
      target: numTarget,
      window,
      evaluationInterval,
      enabled,
      alertSettings: {
        burnRateAlerts: {
          enabled: burnRateAlertsEnabled,
          thresholds: [
            {
              window: "5m",
              rate: Number(burn5mThreshold),
              severity: "critical",
            },
            {
              window: "30m",
              rate: Number(burn30mThreshold),
              severity: "critical",
            },
            {
              window: "6h",
              rate: Number(burn6hThreshold),
              severity: "warning",
            },
          ],
        },
        budgetWarningThreshold: Number(budgetWarningThreshold),
        budgetExhaustedAlert,
        cooldownMinutes: Number(cooldownMinutes),
      },
    };

    if (isEditing) {
      updateSlo(id, payload);
    } else {
      createSlo(payload);
    }
  };

  if (loading) {
    return (
      <Page title="Loading SLO..." description="Fetching objective settings...">
        <div className="h-48 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse max-w-2xl mx-auto" />
      </Page>
    );
  }

  const allowableDowntime = calculateAllowableDowntime(target, window);

  return (
    <Page
      eyebrow={
        <Link
          to={isEditing ? sloDetailsPath(id) : ROUTES.SLOS}
          className="inline-flex items-center gap-1 text-slate-500 hover:text-emerald-600 transition-colors"
        >
          <ArrowLeft size={12} />{" "}
          {isEditing ? "BACK TO OBJECTIVE" : "ALL SERVICE LEVEL OBJECTIVES"}
        </Link>
      }
      title={
        isEditing
          ? "Edit Service Level Objective"
          : "Create Service Level Objective"
      }
      description="Define uptime commitments, calculation windows, and multi-window burn rate alerts."
    >
      <div className="max-w-2xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 space-y-6">
        {formError && (
          <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300 flex items-start gap-2">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Monitor selector */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
              Target Monitor *
            </label>
            <select
              value={monitorId}
              onChange={handleMonitorChange}
              disabled={isEditing || loadingMonitors}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {loadingMonitors ? (
                <option value="">Loading monitors...</option>
              ) : monitors.length === 0 ? (
                <option value="">No monitors available</option>
              ) : (
                monitors.map((m) => (
                  <option key={m.id || m._id} value={m.id || m._id}>
                    {m.name} ({m.url})
                  </option>
                ))
              )}
            </select>
          </div>

          {/* SLO Name */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
              SLO Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Production Web Availability (99.9%)"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
              Description (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this objective measures and business commitments..."
              rows={2}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
          </div>

          {/* Availability Target % */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                Availability Target (%) *
              </label>
              <div className="flex items-center gap-1">
                {TARGET_PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setTarget(p)}
                    className={`px-2 py-0.5 text-xs rounded border transition-colors ${
                      Number(target) === p
                        ? "bg-emerald-500 text-white border-emerald-600 font-semibold"
                        : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {p}%
                  </button>
                ))}
              </div>
            </div>
            <input
              type="number"
              step="0.001"
              min="50"
              max="99.999"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
              required
            />
          </div>

          {/* Window & Interval Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                Rolling Window
              </label>
              <select
                value={window}
                onChange={(e) => setWindow(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {SLO_WINDOWS.map((w) => (
                  <option key={w.value} value={w.value}>
                    {w.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                Evaluation Cadence
              </label>
              <select
                value={evaluationInterval}
                onChange={(e) => setEvaluationInterval(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {EVALUATION_INTERVALS.map((i) => (
                  <option key={i.value} value={i.value}>
                    Every {i.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Live Allowance Preview */}
          <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/50 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Sparkles
                className="text-emerald-600 dark:text-emerald-400 shrink-0"
                size={16}
              />
              <span className="text-emerald-900 dark:text-emerald-200 font-medium">
                Allowable Downtime ({window} window):
              </span>
            </div>
            <b className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
              {allowableDowntime}
            </b>
          </div>

          {/* Enabled toggle */}
          <label className="flex items-center gap-2 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
            />
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Enable automated background evaluation
            </span>
          </label>

          {/* Advanced Alerting Rules */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setShowAdvancedAlerts(!showAdvancedAlerts)}
              className="flex items-center justify-between w-full text-xs font-semibold text-slate-600 dark:text-slate-400 py-1 hover:text-slate-900"
            >
              <span>Alert Thresholds & Burn Rate Rules</span>
              {showAdvancedAlerts ? (
                <ChevronUp size={15} />
              ) : (
                <ChevronDown size={15} />
              )}
            </button>

            {showAdvancedAlerts && (
              <div className="mt-3 space-y-3 p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-700/60 text-xs">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={burnRateAlertsEnabled}
                    onChange={(e) => setBurnRateAlertsEnabled(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                  />
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    Enable multi-window burn rate alerts
                  </span>
                </label>

                {burnRateAlertsEnabled && (
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <div>
                      <label className="text-[11px] text-slate-500 block mb-1">
                        Short (5m)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="1"
                        max="100"
                        value={burn5mThreshold}
                        onChange={(e) => setBurn5mThreshold(e.target.value)}
                        className="w-full px-2 py-1.5 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-500 block mb-1">
                        Medium (30m)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="1"
                        max="100"
                        value={burn30mThreshold}
                        onChange={(e) => setBurn30mThreshold(e.target.value)}
                        className="w-full px-2 py-1.5 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-500 block mb-1">
                        Long (6h)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="1"
                        max="100"
                        value={burn6hThreshold}
                        onChange={(e) => setBurn6hThreshold(e.target.value)}
                        className="w-full px-2 py-1.5 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                  <div>
                    <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400 block mb-1">
                      Budget Warning Threshold (%)
                    </label>
                    <input
                      type="number"
                      min="50"
                      max="99"
                      value={budgetWarningThreshold}
                      onChange={(e) =>
                        setBudgetWarningThreshold(e.target.value)
                      }
                      className="w-full px-2 py-1.5 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400 block mb-1">
                      Alert Cooldown (Minutes)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="1440"
                      value={cooldownMinutes}
                      onChange={(e) => setCooldownMinutes(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={budgetExhaustedAlert}
                    onChange={(e) => setBudgetExhaustedAlert(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                  />
                  <span className="text-[11px] text-slate-600 dark:text-slate-300">
                    Dispatch notification immediately when error budget is
                    exhausted
                  </span>
                </label>
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                navigate(isEditing ? sloDetailsPath(id) : ROUTES.SLOS)
              }
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting
                ? "Saving..."
                : isEditing
                  ? "Save Changes"
                  : "Create Objective"}
            </Button>
          </div>
        </form>
      </div>
    </Page>
  );
}
