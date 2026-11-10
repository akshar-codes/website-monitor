import { useMemo } from "react";
import { describeCron, validateCron } from "../../utils/cronParser.js";
import { describeInterval } from "../../utils/jobFormat.js";
import { JOB_SCHEDULE_TYPES } from "../../constants/jobs.js";
import { AlertCircle, CheckCircle2 } from "lucide-react";

export default function JobSchedulePreview({
  scheduleType,
  intervalSeconds,
  cronExpression,
  timezone = "UTC",
}) {
  const preview = useMemo(() => {
    if (scheduleType === JOB_SCHEDULE_TYPES.INTERVAL) {
      if (!intervalSeconds || isNaN(Number(intervalSeconds))) {
        return {
          valid: false,
          message: "Please specify an interval in seconds.",
        };
      }
      const sec = Number(intervalSeconds);
      if (sec < 60) {
        return { valid: false, message: "Minimum interval is 60 seconds." };
      }
      return { valid: true, message: describeInterval(sec) };
    }

    if (scheduleType === JOB_SCHEDULE_TYPES.CRON) {
      if (!cronExpression || !cronExpression.trim()) {
        return { valid: false, message: "Please enter a cron expression." };
      }
      const validation = validateCron(cronExpression);
      if (!validation.valid) {
        return {
          valid: false,
          message: validation.error || "Invalid cron expression",
        };
      }
      const desc = describeCron(cronExpression, timezone);
      return { valid: true, message: desc };
    }

    return { valid: false, message: "Select a schedule type." };
  }, [scheduleType, intervalSeconds, cronExpression, timezone]);

  return (
    <div
      className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 transition-colors ${
        preview.valid
          ? "bg-slate-50 border-slate-200 text-slate-700"
          : "bg-amber-50 border-amber-200 text-amber-800"
      }`}
      data-testid="job-schedule-preview"
    >
      {preview.valid ? (
        <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
      ) : (
        <AlertCircle size={16} className="text-amber-500 shrink-0 mt-0.5" />
      )}
      <div className="space-y-0.5">
        <span className="font-semibold block">
          {preview.valid ? "Schedule Preview" : "Invalid Schedule"}
        </span>
        <span className="text-slate-600">
          {preview.message}
        </span>
      </div>
    </div>
  );
}
