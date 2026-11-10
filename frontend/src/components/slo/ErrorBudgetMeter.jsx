import {
  formatBudgetDuration,
  formatPercentage,
} from "../../utils/sloFormat.js";
import { formatDuration } from "../../utils/format.js";
import { AlertTriangle, CheckCircle, ShieldAlert, Clock } from "lucide-react";

export default function ErrorBudgetMeter({
  allowedErrorBudgetSeconds = 0,
  consumedBudgetSeconds = 0,
  remainingBudgetSeconds = 0,
  remainingBudgetPercentage = 100,
  budgetConsumptionPercentage = 0,
  goodDurationSeconds = 0,
  badDurationSeconds = 0,
  unknownDurationSeconds = 0,
  maintenanceDurationSeconds = 0,
  compact = false,
}) {
  const isExhausted = remainingBudgetSeconds <= 0;
  const isAtRisk = !isExhausted && remainingBudgetPercentage < 20;

  // Visual meter clamp 0 to 100%
  const visualPct = isExhausted
    ? 0
    : Math.max(0, Math.min(100, remainingBudgetPercentage));

  const barColor = isExhausted
    ? "bg-rose-500"
    : isAtRisk
      ? "bg-amber-500"
      : "bg-emerald-500";

  if (compact) {
    return (
      <div className="w-full space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500 font-medium">Budget:</span>
          <span
            className={`font-semibold ${
              isExhausted
                ? "text-rose-600"
                : isAtRisk
                  ? "text-amber-600"
                  : "text-emerald-600"
            }`}
          >
            {formatBudgetDuration(remainingBudgetSeconds)} (
            {formatPercentage(remainingBudgetPercentage, 1)})
          </span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${barColor}`}
            style={{ width: `${visualPct}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <span>Error Budget</span>
            {isExhausted ? (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md font-medium bg-rose-50 text-rose-700 border border-rose-200">
                <ShieldAlert size={13} /> Depleted
              </span>
            ) : isAtRisk ? (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md font-medium bg-amber-50 text-amber-700 border border-amber-200">
                <AlertTriangle size={13} /> High Consumption
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle size={13} /> Within Budget
              </span>
            )}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Allowable downtime allocation and current consumption status
          </p>
        </div>

        <div className="text-right">
          <span className="text-xs text-slate-400 block">Remaining Budget</span>
          <span
            className={`text-xl font-bold tracking-tight ${
              isExhausted
                ? "text-rose-600"
                : isAtRisk
                  ? "text-amber-600"
                  : "text-emerald-600"
            }`}
          >
            {formatBudgetDuration(remainingBudgetSeconds)}
          </span>
          <span className="text-xs text-slate-400 ml-1.5">
            ({formatPercentage(remainingBudgetPercentage, 1)})
          </span>
        </div>
      </div>

      {/* Progress meter */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-slate-500 font-medium">
          <span>
            Consumed: {formatPercentage(budgetConsumptionPercentage, 1)} (
            {formatDuration(consumedBudgetSeconds)})
          </span>
          <span>
            Total Allowed: {formatDuration(allowedErrorBudgetSeconds)}
          </span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden p-0.5 flex">
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${visualPct}%` }}
            role="progressbar"
            aria-valuenow={Math.round(remainingBudgetPercentage)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Remaining error budget percentage"
          />
        </div>
      </div>

      {/* Telemetry Breakdown Details */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
        <div className="p-2.5 rounded-lg bg-slate-50">
          <span className="text-xs text-slate-500 block">Good Duration</span>
          <span className="text-sm font-semibold text-emerald-600">
            {formatDuration(goodDurationSeconds)}
          </span>
        </div>

        <div className="p-2.5 rounded-lg bg-slate-50">
          <span className="text-xs text-slate-500 block">Bad Duration</span>
          <span className="text-sm font-semibold text-rose-600">
            {formatDuration(badDurationSeconds)}
          </span>
        </div>

        <div className="p-2.5 rounded-lg bg-slate-50">
          <span className="text-xs text-slate-500 flex items-center gap-1">
            <Clock size={12} /> Unknown Duration
          </span>
          <span className="text-sm font-semibold text-slate-600">
            {formatDuration(unknownDurationSeconds)}
          </span>
          <span className="text-[10px] text-slate-400 block leading-tight mt-0.5">
            Never counted as success
          </span>
        </div>

        <div className="p-2.5 rounded-lg bg-slate-50">
          <span className="text-xs text-slate-500 block">Maintenance</span>
          <span className="text-sm font-semibold text-blue-600">
            {formatDuration(maintenanceDurationSeconds)}
          </span>
          <span className="text-[10px] text-slate-400 block leading-tight mt-0.5">
            Excluded from calculation
          </span>
        </div>
      </div>
    </div>
  );
}
