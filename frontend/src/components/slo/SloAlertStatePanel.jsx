import { formatRelative } from "../../utils/format.js";
import { formatBurnRate } from "../../utils/sloFormat.js";
import { BellRing, CheckCircle, AlertTriangle } from "lucide-react";

export default function SloAlertStatePanel({ alertState }) {
  if (!alertState) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm text-center text-xs text-slate-400">
        No alert state initialized yet.
      </div>
    );
  }

  const {
    status = "healthy",
    activeAlerts = [],
    incidentSequence = 0,
    consecutiveBreaches = 0,
    consecutiveRecoveries = 0,
    lastAlertAt = null,
    lastResolvedAt = null,
  } = alertState;

  const hasActiveAlerts = activeAlerts.length > 0;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <BellRing className="text-slate-600 dark:text-slate-300" size={18} />
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Alert State & Incident Lifecycle
          </h3>
        </div>

        <span
          className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize border ${
            status === "exhausted"
              ? "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300"
              : status === "breached"
                ? "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300"
                : status === "warning"
                  ? "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300"
                  : "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300"
          }`}
        >
          {status}
        </span>
      </div>

      {hasActiveAlerts ? (
        <div className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1">
            <AlertTriangle size={13} /> Active Alert Conditions (
            {activeAlerts.length})
          </span>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-rose-100 dark:border-rose-950/50 rounded-lg overflow-hidden bg-rose-50/20 dark:bg-rose-950/10">
            {activeAlerts.map((alert, index) => (
              <div
                key={alert.dedupeKey || index}
                className="p-3 text-xs flex flex-wrap items-center justify-between gap-2"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <b className="font-semibold text-slate-900 dark:text-slate-100 capitalize">
                      {alert.type?.replace(/_/g, " ")}{" "}
                      {alert.window ? `(${alert.window})` : ""}
                    </b>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase ${
                        alert.severity === "critical"
                          ? "bg-rose-200 text-rose-900 dark:bg-rose-900 dark:text-rose-100"
                          : "bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-100"
                      }`}
                    >
                      {alert.severity}
                    </span>
                  </div>
                  {alert.rate != null && (
                    <span className="text-slate-500 block">
                      Burn rate: {formatBurnRate(alert.rate)} (Threshold:{" "}
                      {alert.thresholdRate}x)
                    </span>
                  )}
                  <span className="text-[10px] text-slate-400 font-mono block">
                    Dedupe key: {alert.dedupeKey}
                  </span>
                </div>

                <div className="text-right text-slate-500">
                  <span>Triggered {formatRelative(alert.triggeredAt)}</span>
                  {alert.lastNotifiedAt && (
                    <small className="block text-slate-400">
                      Notified: {formatRelative(alert.lastNotifiedAt)}
                    </small>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="p-3 rounded-lg bg-emerald-50/50 border border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/40 flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300">
          <CheckCircle
            size={15}
            className="text-emerald-600 dark:text-emerald-400 shrink-0"
          />
          <span>
            No active alert conditions. Notification deduplication key is clear.
          </span>
        </div>
      )}

      {/* Lifecycle metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
        <div>
          <span className="block text-[11px] text-slate-400">
            Incident Sequence
          </span>
          <b className="text-slate-700 dark:text-slate-200">
            #{incidentSequence}
          </b>
        </div>
        <div>
          <span className="block text-[11px] text-slate-400">
            Consecutive Breaches
          </span>
          <b className="text-slate-700 dark:text-slate-200">
            {consecutiveBreaches}
          </b>
        </div>
        <div>
          <span className="block text-[11px] text-slate-400">
            Consecutive Recoveries
          </span>
          <b className="text-slate-700 dark:text-slate-200">
            {consecutiveRecoveries}
          </b>
        </div>
        <div>
          <span className="block text-[11px] text-slate-400">Last Alert</span>
          <b className="text-slate-700 dark:text-slate-200">
            {lastAlertAt ? formatRelative(lastAlertAt) : "None"}
          </b>
        </div>
        <div>
          <span className="block text-[11px] text-slate-400">
            Last Resolved
          </span>
          <b className="text-slate-700 dark:text-slate-200">
            {lastResolvedAt ? formatRelative(lastResolvedAt) : "None"}
          </b>
        </div>
      </div>
    </div>
  );
}
