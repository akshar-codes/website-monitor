import { describeCron } from "./cronParser.js";
import {
  JOB_STATUS,
  JOB_RUN_STATUS,
  JOB_SCHEDULE_TYPES,
} from "../constants/jobs.js";

/**
 * Formats interval seconds into a friendly human-readable string.
 */
export function describeInterval(seconds) {
  if (seconds == null || isNaN(seconds)) return "—";
  const sec = Number(seconds);
  if (sec < 60) return `Every ${sec} seconds`;
  if (sec === 60) return "Every minute";
  if (sec < 3600) {
    const mins = Math.round(sec / 60);
    return mins === 1 ? "Every minute" : `Every ${mins} minutes`;
  }
  if (sec === 3600) return "Every hour";
  if (sec < 86400) {
    const hours = Math.round(sec / 3600);
    return hours === 1 ? "Every hour" : `Every ${hours} hours`;
  }
  const days = Math.round(sec / 86400);
  return days === 1 ? "Every day" : `Every ${days} days`;
}

/**
 * Formats a full schedule summary for a JobMonitor.
 */
export function formatJobSchedule(job) {
  if (!job) return "—";
  if (job.scheduleType === JOB_SCHEDULE_TYPES.INTERVAL) {
    return describeInterval(job.intervalSeconds);
  }
  if (job.scheduleType === JOB_SCHEDULE_TYPES.CRON) {
    return describeCron(job.cronExpression, job.timezone);
  }
  return "Custom schedule";
}

/**
 * Formats milliseconds into human-readable duration (e.g. "124ms", "3.2s", "1m 45s").
 */
export function formatExecutionDuration(ms) {
  if (ms == null || isNaN(ms)) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const sec = ms / 1000;
  if (sec < 60) return `${sec.toFixed(2)}s`;
  const mins = Math.floor(sec / 60);
  const remainingSec = Math.round(sec % 60);
  if (mins < 60) return `${mins}m ${remainingSec}s`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hrs}h ${remMins}m`;
}

/**
 * Returns badge label, class tone, and description for a JobMonitor status.
 */
export function getJobStatusBadgeProps(status, active = true) {
  if (!active || status === JOB_STATUS.PAUSED) {
    return {
      label: "Paused",
      tone: "paused",
      bgClass: "bg-slate-100 text-slate-700 border-slate-300",
      dotClass: "bg-slate-400",
    };
  }

  switch (status) {
    case JOB_STATUS.UP:
      return {
        label: "Operational",
        tone: "up",
        bgClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
        dotClass: "bg-emerald-500",
      };
    case JOB_STATUS.LATE:
      return {
        label: "Late",
        tone: "late",
        bgClass: "bg-amber-50 text-amber-700 border-amber-200",
        dotClass: "bg-amber-500",
      };
    case JOB_STATUS.DOWN:
      return {
        label: "Down",
        tone: "down",
        bgClass: "bg-rose-50 text-rose-700 border-rose-200",
        dotClass: "bg-rose-500",
      };
    case JOB_STATUS.PENDING:
    default:
      return {
        label: "Awaiting Ping",
        tone: "pending",
        bgClass: "bg-blue-50 text-blue-700 border-blue-200",
        dotClass: "bg-blue-500",
      };
  }
}

/**
 * Returns badge label, class tone, and styling for a JobRun outcome.
 */
export function getJobRunStatusBadgeProps(status) {
  switch (status) {
    case JOB_RUN_STATUS.SUCCEEDED:
      return {
        label: "Succeeded",
        tone: "succeeded",
        bgClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
        dotClass: "bg-emerald-500",
      };
    case JOB_RUN_STATUS.FAILED:
      return {
        label: "Failed",
        tone: "failed",
        bgClass: "bg-rose-50 text-rose-700 border-rose-200",
        dotClass: "bg-rose-500",
      };
    case JOB_RUN_STATUS.TIMED_OUT:
      return {
        label: "Timed Out",
        tone: "timed_out",
        bgClass: "bg-orange-50 text-orange-700 border-orange-200",
        dotClass: "bg-orange-500",
      };
    case JOB_RUN_STATUS.MISSED:
      return {
        label: "Missed",
        tone: "missed",
        bgClass: "bg-purple-50 text-purple-700 border-purple-200",
        dotClass: "bg-purple-500",
      };
    case JOB_RUN_STATUS.STARTED:
      return {
        label: "Running",
        tone: "started",
        bgClass: "bg-sky-50 text-sky-700 border-sky-200",
        dotClass: "bg-sky-500 animate-pulse",
      };
    default:
      return {
        label: status || "Unknown",
        tone: "unknown",
        bgClass: "bg-slate-100 text-slate-700 border-slate-300",
        dotClass: "bg-slate-400",
      };
  }
}

/**
 * Generates heartbeat reporting code snippets for cURL, Node.js, and Python.
 */
export function generateHeartbeatSnippets({
  jobMonitorId,
  token = "<YOUR_TOKEN>",
  origin = typeof window !== "undefined"
    ? window.location.origin
    : "https://app.sitewatch.com",
}) {
  const reportingUrl = `${origin}/api/job-heartbeats/${jobMonitorId || ":jobMonitorId"}`;

  const curl = `# 1. Signal when job starts (recommended for execution timeout detection)
curl -s -X POST "${reportingUrl}" \\
  -H "Authorization: Bearer ${token}" \\
  -H "Content-Type: application/json" \\
  -d '{"event":"started","runId":"run_$(date +%s)"}'

# 2. Signal when job succeeds
curl -s -X POST "${reportingUrl}" \\
  -H "Authorization: Bearer ${token}" \\
  -H "Content-Type: application/json" \\
  -d '{"event":"succeeded","runId":"run_$(date +%s)"}'

# 3. Or single ping on completion (auto-captures duration)
curl -s -X POST "${reportingUrl}" \\
  -H "Authorization: Bearer ${token}" \\
  -H "Content-Type: application/json" \\
  -d '{"event":"succeeded"}'`;

  const nodejs = `// npm install axios or use built-in fetch (Node 18+)
const REPORTING_URL = "${reportingUrl}";
const TOKEN = process.env.JOB_MONITOR_TOKEN || "${token}";

async function executeTask() {
  const runId = \`backup_\${Date.now()}\`;

  // 1. Signal started
  await fetch(REPORTING_URL, {
    method: "POST",
    headers: {
      "Authorization": \`Bearer \${TOKEN}\`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ event: "started", runId })
  });

  const startTime = Date.now();
  try {
    // >>> Place your actual job logic here <<<
    console.log("Running task...");

    // 2. Signal success
    await fetch(REPORTING_URL, {
      method: "POST",
      headers: {
        "Authorization": \`Bearer \${TOKEN}\`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        event: "succeeded",
        runId,
        durationMs: Date.now() - startTime
      })
    });
  } catch (err) {
    // 3. Signal failure with error details
    await fetch(REPORTING_URL, {
      method: "POST",
      headers: {
        "Authorization": \`Bearer \${TOKEN}\`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        event: "failed",
        runId,
        errorMessage: err.message,
        exitCode: 1
      })
    });
    throw err;
  }
}

executeTask();`;

  const python = `# pip install requests
import os
import time
import requests

REPORTING_URL = "${reportingUrl}"
TOKEN = os.getenv("JOB_MONITOR_TOKEN", "${token}")
HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json"
}

def run_job():
    run_id = f"job_{int(time.time())}"
    start_time = time.time()

    # 1. Signal started
    requests.post(REPORTING_URL, headers=HEADERS, json={
        "event": "started",
        "runId": run_id
    })

    try:
        # >>> Place your actual job execution here <<<
        print("Executing scheduled task...")

        duration_ms = int((time.time() - start_time) * 1000)
        # 2. Signal success
        requests.post(REPORTING_URL, headers=HEADERS, json={
            "event": "succeeded",
            "runId": run_id,
            "durationMs": duration_ms
        })
    except Exception as exc:
        # 3. Signal failure
        requests.post(REPORTING_URL, headers=HEADERS, json={
            "event": "failed",
            "runId": run_id,
            "errorMessage": str(exc),
            "exitCode": 1
        })
        raise

if __name__ == "__main__":
    run_job()`;

  return { curl, nodejs, python, reportingUrl };
}
