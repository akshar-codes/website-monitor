import { useState, useEffect } from "react";
import {
  SLO_WINDOWS,
  EVALUATION_INTERVALS,
  TARGET_PRESETS,
  calculateAllowableDowntime,
} from "../../utils/sloFormat";
import * as monitorsApi from "../../services/api/monitors";
import { X, Sparkles, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";

function SloFormDialog({
  onClose,
  onSubmit,
  initialData = null,
  initialMonitorId = null,
  submitting = false,
  error = null,
}) {
  const [monitors, setMonitors] = useState([]);
  const [loadingMonitors, setLoadingMonitors] = useState(true);
  const [showAdvancedAlerts, setShowAdvancedAlerts] = useState(false);

  // Form state initialized directly from props
  const [monitorId, setMonitorId] = useState(
    initialData?.monitor?._id ||
      initialData?.monitor?.id ||
      initialData?.monitor ||
      initialMonitorId ||
      "",
  );
  const [name, setName] = useState(initialData?.name || "");
  const [description, setDescription] = useState(
    initialData?.description || "",
  );
  const [target, setTarget] = useState(initialData?.target ?? 99.9);
  const [window, setWindow] = useState(initialData?.window || "30d");
  const [evaluationInterval, setEvaluationInterval] = useState(
    initialData?.evaluationInterval || "5m",
  );
  const [enabled, setEnabled] = useState(initialData?.enabled ?? true);

  // Alert settings
  const thresholds =
    initialData?.alertSettings?.burnRateAlerts?.thresholds || [];
  const t5m = thresholds.find((t) => t.window === "5m");
  const t30m = thresholds.find((t) => t.window === "30m");
  const t6h = thresholds.find((t) => t.window === "6h");

  const [burnRateAlertsEnabled, setBurnRateAlertsEnabled] = useState(
    initialData?.alertSettings?.burnRateAlerts?.enabled ?? true,
  );
  const [burn5mThreshold, setBurn5mThreshold] = useState(t5m?.rate ?? 14.4);
  const [burn30mThreshold, setBurn30mThreshold] = useState(t30m?.rate ?? 6.0);
  const [burn6hThreshold, setBurn6hThreshold] = useState(t6h?.rate ?? 2.0);
  const [budgetWarningThreshold, setBudgetWarningThreshold] = useState(
    initialData?.alertSettings?.budgetWarningThreshold ?? 80,
  );
  const [budgetExhaustedAlert, setBudgetExhaustedAlert] = useState(
    initialData?.alertSettings?.budgetExhaustedAlert ?? true,
  );
  const [cooldownMinutes, setCooldownMinutes] = useState(
    initialData?.alertSettings?.cooldownMinutes ?? 60,
  );

  const [formError, setFormError] = useState("");

  // Load monitors asynchronously without synchronous setState in effect
  useEffect(() => {
    let active = true;
    monitorsApi
      .getMonitors({ limit: 100 })
      .then((res) => {
        if (!active) return;
        const list = res?.data || [];
        setMonitors(list);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoadingMonitors(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleMonitorChange = (e) => {
    const nextId = e.target.value;
    setMonitorId(nextId);
    if (!initialData) {
      const selectedMon = monitors.find((m) => (m.id || m._id) === nextId);
      if (selectedMon) {
        setName(`${selectedMon.name} 99.9% Availability`);
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") onClose();
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

    onSubmit(payload);
  };

  const allowableDowntime = calculateAllowableDowntime(target, window);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto"
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="slo-modal-title"
    >
      <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 my-8 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2
              id="slo-modal-title"
              className="text-lg font-bold text-slate-900 dark:text-slate-100"
            >
              {initialData
                ? "Edit Service Level Objective"
                : "Create Service Level Objective"}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Configure availability targets, rolling measurement window, and
              error budget alerts.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="p-6 space-y-4 max-h-[80vh] overflow-y-auto"
        >
          {(formError || error) && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300 flex items-start gap-2">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <span>
                {formError ||
                  error?.response?.data?.message ||
                  error?.message ||
                  "An error occurred"}
              </span>
            </div>
          )}

          {/* Monitor selector */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
              Target Monitor *
            </label>
            <select
              value={monitorId}
              onChange={handleMonitorChange}
              disabled={!!initialData || loadingMonitors}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {loadingMonitors ? (
                <option value="">Loading monitors...</option>
              ) : monitors.length === 0 ? (
                <option value="">No monitors found</option>
              ) : (
                <>
                  <option value="">Select a monitor...</option>
                  {monitors.map((m) => (
                    <option key={m.id || m._id} value={m.id || m._id}>
                      {m.name} ({m.url})
                    </option>
                  ))}
                </>
              )}
            </select>
            {initialData && (
              <span className="text-[11px] text-slate-400">
                The target monitor cannot be changed after creation.
              </span>
            )}
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
              Enable automated evaluation for this objective
            </span>
          </label>

          {/* Advanced Alerting Settings Toggle */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setShowAdvancedAlerts(!showAdvancedAlerts)}
              className="flex items-center justify-between w-full text-xs font-semibold text-slate-600 dark:text-slate-400 py-1 hover:text-slate-900 dark:hover:text-slate-200"
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
                    exhausted (remaining &le; 0)
                  </span>
                </label>
              </div>
            )}
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-lg shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {submitting
                ? "Saving..."
                : initialData
                  ? "Update Objective"
                  : "Create Objective"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function SloFormModal(props) {
  if (!props.isOpen) return null;
  const dialogKey =
    props.initialData?.id ||
    props.initialData?._id ||
    props.initialMonitorId ||
    "new";
  return <SloFormDialog key={dialogKey} {...props} />;
}
