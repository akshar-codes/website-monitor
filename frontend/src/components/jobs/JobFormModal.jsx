import { useState } from "react";
import {
  JOB_SCHEDULE_TYPES,
  INTERVAL_PRESETS,
  CRON_PRESETS,
  COMMON_TIMEZONES,
} from "../../constants/jobs.js";
import JobSchedulePreview from "./JobSchedulePreview.jsx";
import { validateCron } from "../../utils/cronParser.js";
import { X, ChevronDown, ChevronUp, AlertCircle, Sparkles } from "lucide-react";

export default function JobFormModal({
  isOpen = true,
  onClose,
  onSubmit,
  initialData = null,
  submitting = false,
  error = null,
}) {
  const isEditing = Boolean(initialData);

  // Form State
  const [name, setName] = useState(initialData?.name || "");
  const [description, setDescription] = useState(
    initialData?.description || "",
  );
  const [scheduleType, setScheduleType] = useState(
    initialData?.scheduleType || JOB_SCHEDULE_TYPES.CRON,
  );
  const [intervalSeconds, setIntervalSeconds] = useState(
    initialData?.intervalSeconds || 3600,
  );
  const [cronExpression, setCronExpression] = useState(
    initialData?.cronExpression || "0 0 * * *",
  );
  const [timezone, setTimezone] = useState(
    initialData?.timezone ||
      Intl.DateTimeFormat().resolvedOptions().timeZone ||
      "UTC",
  );

  // Advanced settings
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [gracePeriodSeconds, setGracePeriodSeconds] = useState(
    initialData?.gracePeriodSeconds ?? 300,
  );
  const [runTimeoutSeconds, setRunTimeoutSeconds] = useState(
    initialData?.runTimeoutSeconds ?? 3600,
  );
  const [failureThreshold, setFailureThreshold] = useState(
    initialData?.failureThreshold ?? 1,
  );
  const [recoveryThreshold, setRecoveryThreshold] = useState(
    initialData?.recoveryThreshold ?? 1,
  );

  const [validationError, setValidationError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    setValidationError("");

    if (!name.trim()) {
      setValidationError("Job name is required.");
      return;
    }

    if (scheduleType === JOB_SCHEDULE_TYPES.INTERVAL) {
      const sec = Number(intervalSeconds);
      if (!sec || isNaN(sec) || sec < 60) {
        setValidationError("Interval must be at least 60 seconds.");
        return;
      }
    } else if (scheduleType === JOB_SCHEDULE_TYPES.CRON) {
      if (!cronExpression.trim()) {
        setValidationError("Cron expression is required.");
        return;
      }
      const v = validateCron(cronExpression);
      if (!v.valid) {
        setValidationError(v.error || "Invalid cron expression.");
        return;
      }
    }

    const payload = {
      name: name.trim(),
      description: description.trim() || undefined,
      scheduleType,
      timezone: timezone || "UTC",
      gracePeriodSeconds: Number(gracePeriodSeconds) || 300,
      runTimeoutSeconds: Number(runTimeoutSeconds) || 3600,
      failureThreshold: Number(failureThreshold) || 1,
      recoveryThreshold: Number(recoveryThreshold) || 1,
    };

    if (scheduleType === JOB_SCHEDULE_TYPES.INTERVAL) {
      payload.intervalSeconds = Number(intervalSeconds);
    } else {
      payload.cronExpression = cronExpression.trim();
    }

    onSubmit(payload);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="job-form-modal-title"
    >
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 my-8 overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2
              id="job-form-modal-title"
              className="text-lg font-bold text-slate-900"
            >
              {isEditing ? "Edit Background Job" : "Create Background Job"}
            </h2>
            <p className="text-xs text-slate-500">
              Configure scheduled heartbeats, execution deadlines, and failure
              thresholds.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body / Form */}
        <form
          onSubmit={handleSubmit}
          className="p-6 space-y-4 max-h-[80vh] overflow-y-auto"
        >
          {(validationError || error) && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <span>
                {validationError ||
                  error?.response?.data?.message ||
                  error?.message ||
                  "An error occurred."}
              </span>
            </div>
          )}

          {/* Job Name */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 block">
              Job Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Nightly Database Backup"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              maxLength={100}
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 block">
              Description{" "}
              <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this background job or cron task runs..."
              rows={2}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              maxLength={500}
            />
          </div>

          {/* Schedule Type Toggle */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 block">
              Schedule Type *
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setScheduleType(JOB_SCHEDULE_TYPES.CRON)}
                className={`py-2 px-3 rounded-lg border text-xs font-medium transition-all text-center flex items-center justify-center gap-2 ${
                  scheduleType === JOB_SCHEDULE_TYPES.CRON
                    ? "border-emerald-500 bg-emerald-50/50 text-emerald-700 shadow-sm"
                    : "border-slate-200 hover:bg-slate-50 text-slate-600"
                }`}
              >
                <span>Cron Expression</span>
              </button>
              <button
                type="button"
                onClick={() => setScheduleType(JOB_SCHEDULE_TYPES.INTERVAL)}
                className={`py-2 px-3 rounded-lg border text-xs font-medium transition-all text-center flex items-center justify-center gap-2 ${
                  scheduleType === JOB_SCHEDULE_TYPES.INTERVAL
                    ? "border-emerald-500 bg-emerald-50/50 text-emerald-700 shadow-sm"
                    : "border-slate-200 hover:bg-slate-50 text-slate-600"
                }`}
              >
                <span>Simple Interval</span>
              </button>
            </div>
          </div>

          {/* Cron Inputs */}
          {scheduleType === JOB_SCHEDULE_TYPES.CRON && (
            <div className="space-y-3 p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/80">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700">
                    Cron Expression *
                  </label>
                  <span className="text-[11px] text-slate-400 font-mono">
                    min hour day month dow
                  </span>
                </div>
                <input
                  type="text"
                  value={cronExpression}
                  onChange={(e) => setCronExpression(e.target.value)}
                  placeholder="0 0 * * *"
                  className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              {/* Presets */}
              <div className="space-y-1">
                <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                  <Sparkles size={11} className="text-emerald-500" /> Quick
                  Presets
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {CRON_PRESETS.map((p) => (
                    <button
                      key={p.expression}
                      type="button"
                      onClick={() => setCronExpression(p.expression)}
                      className={`text-[11px] px-2 py-1 rounded-md border transition-colors ${
                        cronExpression === p.expression
                          ? "bg-emerald-500 text-white border-emerald-500"
                          : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Interval Inputs */}
          {scheduleType === JOB_SCHEDULE_TYPES.INTERVAL && (
            <div className="space-y-3 p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/80">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">
                  Interval (Seconds) *
                </label>
                <input
                  type="number"
                  min={60}
                  step={1}
                  value={intervalSeconds}
                  onChange={(e) => setIntervalSeconds(e.target.value)}
                  placeholder="300"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              {/* Presets */}
              <div className="space-y-1">
                <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                  <Sparkles size={11} className="text-emerald-500" /> Presets
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {INTERVAL_PRESETS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setIntervalSeconds(p.value)}
                      className={`text-[11px] px-2 py-1 rounded-md border transition-colors ${
                        Number(intervalSeconds) === p.value
                          ? "bg-emerald-500 text-white border-emerald-500"
                          : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Timezone */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 block">
              Timezone
            </label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="UTC">UTC (Coordinated Universal Time)</option>
              {COMMON_TIMEZONES.filter((tz) => tz !== "UTC").map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>

          {/* Schedule Preview */}
          <JobSchedulePreview
            scheduleType={scheduleType}
            intervalSeconds={intervalSeconds}
            cronExpression={cronExpression}
            timezone={timezone}
          />

          {/* Advanced Settings Accordion */}
          <div className="border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center justify-between w-full text-xs font-semibold text-slate-600 hover:text-slate-900 py-1"
            >
              <span>Advanced Thresholds & Timeouts</span>
              {showAdvanced ? (
                <ChevronUp size={14} />
              ) : (
                <ChevronDown size={14} />
              )}
            </button>

            {showAdvanced && (
              <div className="space-y-3 pt-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Grace Period */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700 block">
                      Grace Period (Seconds)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={86400}
                      value={gracePeriodSeconds}
                      onChange={(e) => setGracePeriodSeconds(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-900"
                    />
                    <small className="text-[10px] text-slate-400">
                      Buffer after expected time before flagging missed runs.
                    </small>
                  </div>

                  {/* Run Timeout */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700 block">
                      Execution Timeout (Seconds)
                    </label>
                    <input
                      type="number"
                      min={10}
                      max={86400}
                      value={runTimeoutSeconds}
                      onChange={(e) => setRunTimeoutSeconds(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-900"
                    />
                    <small className="text-[10px] text-slate-400">
                      Max execution duration before marking timed out.
                    </small>
                  </div>

                  {/* Failure Threshold */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700 block">
                      Failure Threshold
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={failureThreshold}
                      onChange={(e) => setFailureThreshold(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-900"
                    />
                    <small className="text-[10px] text-slate-400">
                      Consecutive failures before opening an incident.
                    </small>
                  </div>

                  {/* Recovery Threshold */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700 block">
                      Recovery Threshold
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={recoveryThreshold}
                      onChange={(e) => setRecoveryThreshold(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-900"
                    />
                    <small className="text-[10px] text-slate-400">
                      Consecutive successes needed to resolve incident.
                    </small>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm disabled:opacity-50 transition-colors flex items-center gap-1.5"
            >
              {submitting
                ? "Saving..."
                : isEditing
                  ? "Save Changes"
                  : "Create Job"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
