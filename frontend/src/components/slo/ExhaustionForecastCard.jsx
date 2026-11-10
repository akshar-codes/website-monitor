import { formatExhaustionHours } from "../../utils/sloFormat.js";
import { formatDateTime } from "../../utils/format.js";
import {
  CalendarClock,
  ShieldAlert,
  Sparkles,
  AlertCircle,
  TrendingDown,
} from "lucide-react";

export default function ExhaustionForecastCard({ forecast }) {
  const status = forecast?.status || "unavailable";
  const hours = forecast?.hoursToExhaustion;
  const projectedAt = forecast?.projectedExhaustionAt;
  const burnRate = forecast?.burnRateUsed;
  const lookbackWindow = forecast?.lookbackWindowUsed || "1h";

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarClock
            className="text-indigo-600 dark:text-indigo-400"
            size={18}
          />
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Exhaustion Forecast
          </h3>
          <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300">
            Estimate
          </span>
        </div>

        <span className="text-xs text-slate-400">
          Based on {lookbackWindow} lookback telemetry
        </span>
      </div>

      {status === "already_exhausted" && (
        <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 dark:bg-rose-950/30 dark:border-rose-900 flex items-start gap-3">
          <ShieldAlert
            className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5"
            size={18}
          />
          <div className="text-xs space-y-1">
            <b className="text-sm font-semibold text-rose-800 dark:text-rose-200 block">
              Budget Already Exhausted
            </b>
            <p className="text-rose-700 dark:text-rose-300">
              Your allowable downtime for this rolling window has been exceeded.
              New failures will further increase budget deficit.
            </p>
          </div>
        </div>
      )}

      {status === "forecasted" && (
        <div className="space-y-3">
          <div className="p-4 rounded-lg bg-indigo-50/50 border border-indigo-100 dark:bg-indigo-950/20 dark:border-indigo-900/60">
            <div className="flex items-start gap-3">
              <TrendingDown
                className="text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5"
                size={18}
              />
              <div className="space-y-1">
                <span className="text-xs text-indigo-700 dark:text-indigo-300 font-medium block">
                  Projected Time to Complete Depletion
                </span>
                <span className="text-2xl font-bold text-indigo-900 dark:text-indigo-100 block">
                  ~{formatExhaustionHours(hours)}
                </span>
                {projectedAt && (
                  <p className="text-xs text-indigo-800 dark:text-indigo-200">
                    Estimated depletion date:{" "}
                    <b>{formatDateTime(projectedAt)}</b>
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span>Extrapolated Burn Velocity:</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {burnRate != null
                ? `${burnRate.toFixed(1)}x allowable rate`
                : "N/A"}
            </span>
          </div>
        </div>
      )}

      {status === "not_exhausting" && (
        <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900 flex items-start gap-3">
          <Sparkles
            className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5"
            size={18}
          />
          <div className="text-xs space-y-1">
            <b className="text-sm font-semibold text-emerald-800 dark:text-emerald-200 block">
              Zero Active Burn
            </b>
            <p className="text-emerald-700 dark:text-emerald-300">
              No service interruptions detected in the recent telemetry window.
              Error budget is healthy and not depleting.
            </p>
          </div>
        </div>
      )}

      {status === "unavailable" && (
        <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 dark:bg-slate-800/40 dark:border-slate-800 flex items-start gap-3">
          <AlertCircle className="text-slate-400 shrink-0 mt-0.5" size={18} />
          <div className="text-xs space-y-1">
            <b className="text-sm font-semibold text-slate-700 dark:text-slate-300 block">
              Forecast Unavailable
            </b>
            <p className="text-slate-500 dark:text-slate-400">
              Insufficient recent observations or zero error rate in lookback
              window to extrapolate a defensible consumption rate.
            </p>
          </div>
        </div>
      )}

      <p className="text-[11px] text-slate-400 italic">
        * Note: Exhaustion forecasts are mathematical projections based on
        recent error velocity. If health improves or traffic stabilizes, budget
        consumption will normalize.
      </p>
    </div>
  );
}
