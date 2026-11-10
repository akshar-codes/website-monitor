import {
  formatBurnRate,
  getLookbackWindowLabel,
  formatPercentage,
} from "../../utils/sloFormat.js";
import { formatDuration } from "../../utils/format.js";
import { Flame, ShieldCheck, AlertCircle } from "lucide-react";

const EVIDENCE_REASON_LABELS = {
  isolated_check: "Isolated check spike suppressed",
  insufficient_samples: "Fewer than 2 checks in window",
  insufficient_coverage: "Data coverage < 50%",
  window_smaller_than_cadence: "Window shorter than 2x cadence",
  no_data: "No check data available",
};

export default function BurnRateCard({
  window = "1h",
  rate = 0,
  thresholdRate = null,
  hasSufficientEvidence = true,
  evidenceReason = null,
  sampleCount = 0,
  eligibleDurationSeconds = 0,
  errorRatePercentage = 0,
}) {
  const isAlerting =
    thresholdRate != null && rate >= thresholdRate && hasSufficientEvidence;

  const isElevated = !isAlerting && rate > 1.0;

  return (
    <div
      className={`border rounded-xl p-4 transition-all shadow-sm ${
        isAlerting
          ? "border-rose-300 bg-rose-50/50"
          : isElevated
            ? "border-amber-200 bg-amber-50/30"
            : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {getLookbackWindowLabel(window)} Lookback
        </span>
        {isAlerting ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">
            <Flame size={12} /> Critical Burn
          </span>
        ) : isElevated ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
            Elevated
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
            Normal
          </span>
        )}
      </div>

      <div className="flex items-baseline gap-2 mb-2">
        <span
          className={`text-2xl font-bold tracking-tight ${
            isAlerting
              ? "text-rose-600"
              : isElevated
                ? "text-amber-600"
                : "text-slate-900"
          }`}
        >
          {formatBurnRate(rate)}
        </span>
        {thresholdRate != null && (
          <span className="text-xs text-slate-400">
            / alert @ {thresholdRate}x
          </span>
        )}
      </div>

      <div className="space-y-1.5 text-xs text-slate-500 pt-2 border-t border-slate-100">
        <div className="flex justify-between">
          <span>Observed Error:</span>
          <span className="font-medium text-slate-700">
            {formatPercentage(errorRatePercentage, 2)}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Samples & Scope:</span>
          <span className="font-medium text-slate-700">
            {sampleCount} checks ({formatDuration(eligibleDurationSeconds)})
          </span>
        </div>
      </div>

      <div className="mt-3 pt-2 border-t border-dashed border-slate-200">
        {hasSufficientEvidence ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
            <ShieldCheck size={12} /> Defensible telemetry
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-1 text-[11px] text-amber-600 font-medium"
            title={EVIDENCE_REASON_LABELS[evidenceReason] || evidenceReason}
          >
            <AlertCircle size={12} />
            <span>
              {EVIDENCE_REASON_LABELS[evidenceReason] ||
                "Insufficient evidence"}
            </span>
          </span>
        )}
      </div>
    </div>
  );
}
