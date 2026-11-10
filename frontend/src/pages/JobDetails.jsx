import { useState, useMemo, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  useJobDetails,
  useJobRuns,
  useJobMutations,
} from "../hooks/useJobs.js";
import { usePermissions } from "../hooks/usePermissions.js";
import { ROUTES } from "../constants/routes.js";
import { Page, Button } from "../components/ui/Primitives.jsx";
import JobStatusBadge from "../components/jobs/JobStatusBadge.jsx";
import JobRunStatusBadge from "../components/jobs/JobRunStatusBadge.jsx";
import JobDurationChart from "../components/jobs/JobDurationChart.jsx";
import JobRunsTable from "../components/jobs/JobRunsTable.jsx";
import JobIncidentsList from "../components/jobs/JobIncidentsList.jsx";
import JobFormModal from "../components/jobs/JobFormModal.jsx";
import HeartbeatSetupModal from "../components/jobs/HeartbeatSetupModal.jsx";
import {
  formatExecutionDuration,
  generateHeartbeatSnippets,
} from "../utils/jobFormat.js";
import { formatRelative } from "../utils/format.js";
import { format } from "date-fns";
import {
  ArrowLeft,
  Terminal,
  RotateCw,
  RefreshCw,
  Pause,
  Play,
  Pencil,
  Trash2,
  AlertTriangle,
  Activity,
  Copy,
  Check,
  ShieldAlert,
  Settings,
} from "lucide-react";
import { toast } from "sonner";

export default function JobDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = usePermissions();
  const canUpdate = can("job-monitor:update");
  const canDelete = can("job-monitor:delete");

  // State
  const [activeTab, setActiveTab] = useState("executions"); // "executions" | "heartbeat" | "incidents" | "configuration"
  const [runStatusFilter, setRunStatusFilter] = useState("all");
  const [runsPage, setRunsPage] = useState(1);

  // Modals
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [setupModalOpen, setSetupModalOpen] = useState(false);
  const [plaintextToken, setPlaintextToken] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState(null);

  // Data fetching
  const {
    data: job,
    loading: jobLoading,
    refetch: refetchJob,
  } = useJobDetails(id);

  const runsParams = useMemo(() => {
    const params = { page: runsPage, limit: 20 };
    if (runStatusFilter !== "all") params.status = runStatusFilter;
    return params;
  }, [runsPage, runStatusFilter]);

  const {
    data: runsResponse,
    loading: runsLoading,
    refetch: refetchRuns,
  } = useJobRuns(id, runsParams);

  const runs = useMemo(() => runsResponse?.data || [], [runsResponse]);
  const pagination = runsResponse?.pagination;

  const handleMutationSuccess = useCallback(
    (action, result) => {
      refetchJob();
      refetchRuns();
      if (action === "update") {
        setEditModalOpen(false);
      } else if (action === "delete") {
        navigate(ROUTES.JOBS, { replace: true });
      } else if (action === "rotate-token") {
        if (result?.token) {
          setPlaintextToken(result.token);
          setSetupModalOpen(true);
        }
      }
    },
    [refetchJob, refetchRuns, navigate],
  );

  const { updateJob, deleteJob, togglePause, rotateToken, submitting } =
    useJobMutations(handleMutationSuccess);

  // Calculate run statistics from recent runs
  const stats = useMemo(() => {
    if (!runs.length) {
      return {
        total: pagination?.total || 0,
        succeeded: 0,
        failed: 0,
        timedOut: 0,
        missed: 0,
        successRate: "—",
        avgDurationMs: null,
      };
    }

    let succ = 0;
    let fail = 0;
    let timeout = 0;
    let miss = 0;
    let durationSum = 0;
    let durationCount = 0;

    runs.forEach((r) => {
      if (r.status === "succeeded") succ++;
      else if (r.status === "failed") fail++;
      else if (r.status === "timed_out") timeout++;
      else if (r.status === "missed") miss++;

      if (r.durationMs != null && r.durationMs > 0) {
        durationSum += r.durationMs;
        durationCount++;
      }
    });

    const terminalRuns = succ + fail + timeout + miss;
    const rate =
      terminalRuns > 0 ? ((succ / terminalRuns) * 100).toFixed(1) : "—";

    return {
      total: pagination?.total || runs.length,
      succeeded: succ,
      failed: fail,
      timedOut: timeout,
      missed: miss,
      successRate: rate !== "—" ? `${rate}%` : "—",
      avgDurationMs:
        durationCount > 0 ? Math.round(durationSum / durationCount) : null,
    };
  }, [runs, pagination]);

  const copyToClipboard = (text, key) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const snippets = useMemo(() => {
    if (!job) return null;
    return generateHeartbeatSnippets({
      jobMonitorId: job.id || job._id,
      token:
        plaintextToken ||
        (job.tokenPrefix ? `${job.tokenPrefix}...` : "<YOUR_TOKEN>"),
    });
  }, [job, plaintextToken]);

  if (jobLoading && !job) {
    return (
      <Page title="Background Job Details">
        <div className="p-12 text-center text-xs text-slate-400">
          Loading background job details...
        </div>
      </Page>
    );
  }

  if (!job) {
    return (
      <Page title="Job Not Found">
        <div className="p-8 text-center space-y-3">
          <p className="text-xs text-slate-500">
            This background job monitor may have been deleted or you do not have
            permission to view it.
          </p>
          <Link to={ROUTES.JOBS}>
            <Button variant="secondary">Back to Background Jobs</Button>
          </Link>
        </div>
      </Page>
    );
  }

  const jobId = job.id || job._id;

  return (
    <Page
      eyebrow="Heartbeat Monitor"
      title={job.name}
      description={job.description || "Background heartbeat reporting job"}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {/* Back link */}
          <Link to={ROUTES.JOBS}>
            <Button variant="secondary">
              <ArrowLeft size={14} />
              <span>Jobs</span>
            </Button>
          </Link>

          {/* Heartbeat setup snippet button */}
          <Button
            variant="secondary"
            onClick={() => setSetupModalOpen(true)}
            title="View integration code and endpoint"
          >
            <Terminal size={14} />
            <span>Heartbeat Setup</span>
          </Button>

          {/* Pause / Resume */}
          {canUpdate && (
            <Button
              variant="secondary"
              onClick={() => togglePause(jobId)}
              title={job.active ? "Pause monitoring" : "Resume monitoring"}
            >
              {job.active ? <Pause size={14} /> : <Play size={14} />}
              <span>{job.active ? "Pause" : "Resume"}</span>
            </Button>
          )}

          {/* Edit */}
          {canUpdate && (
            <Button variant="secondary" onClick={() => setEditModalOpen(true)}>
              <Pencil size={14} />
              <span>Edit</span>
            </Button>
          )}

          {/* Delete */}
          {canDelete && (
            <button
              type="button"
              onClick={() => setDeleteConfirmOpen(true)}
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
              title="Delete job monitor"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-6">
        {/* Active Incident Warning Callout if job is failing */}
        {(job.consecutiveFailures > 0 ||
          job.status === "down" ||
          job.status === "late") && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-start gap-2.5">
              <AlertTriangle
                size={18}
                className="text-rose-600 shrink-0 mt-0.5"
              />
              <div>
                <b className="text-rose-900 block text-sm">
                  Active Incident Detected
                </b>
                <span className="text-rose-700">
                  {job.status === "down"
                    ? `Job is currently failing (${job.consecutiveFailures} consecutive failure(s)).`
                    : `Job is late past its scheduled grace period.`}
                </span>
              </div>
            </div>
            <Link
              to={`/incidents?jobMonitorId=${jobId}`}
              className="px-3 py-1.5 rounded-lg bg-rose-600 text-white font-semibold hover:bg-rose-700 transition-colors shrink-0"
            >
              View Incident Details →
            </Link>
          </div>
        )}

        {/* Top Summary Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Status Metric */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-1">
            <span className="text-xs text-slate-500 font-medium block">
              Current Status
            </span>
            <div className="pt-1">
              <JobStatusBadge status={job.status} active={job.active} />
            </div>
            <small className="text-[10px] text-slate-400 block pt-1">
              {job.active ? "Monitoring active" : "Monitoring paused"}
            </small>
          </div>

          {/* Next Expected */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-1">
            <span className="text-xs text-slate-500 font-medium block">
              Next Expected Run
            </span>
            <strong className="text-lg font-bold text-slate-900 block">
              {job.active && job.nextExpectedAt
                ? formatRelative(job.nextExpectedAt)
                : "Paused"}
            </strong>
            <small className="text-[10px] text-slate-400 block">
              {job.nextExpectedAt
                ? format(new Date(job.nextExpectedAt), "MMM d, HH:mm:ss")
                : "—"}
            </small>
          </div>

          {/* Success Rate */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-1">
            <span className="text-xs text-slate-500 font-medium block">
              Recent Success Rate
            </span>
            <strong className="text-lg font-bold text-emerald-600 block">
              {stats.successRate}
            </strong>
            <small className="text-[10px] text-slate-400 block">
              {stats.succeeded} successful / {stats.total} total runs
            </small>
          </div>

          {/* Last Ping / Duration */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-1">
            <span className="text-xs text-slate-500 font-medium block">
              Last Execution
            </span>
            <div className="flex items-center gap-1.5 pt-0.5">
              {job.lastRunStatus ? (
                <JobRunStatusBadge status={job.lastRunStatus} />
              ) : (
                <span className="text-slate-400 text-xs">No runs</span>
              )}
            </div>
            <small className="text-[10px] text-slate-400 block pt-0.5">
              {job.lastDurationMs != null && (
                <span className="font-mono font-medium text-slate-600">
                  {formatExecutionDuration(job.lastDurationMs)} ·{" "}
                </span>
              )}
              {job.lastPingAt ? formatRelative(job.lastPingAt) : "Never"}
            </small>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="border-b border-slate-200 flex items-center gap-4 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab("executions")}
            className={`pb-3 flex items-center gap-1.5 transition-colors border-b-2 -mb-px ${
              activeTab === "executions"
                ? "border-emerald-500 text-emerald-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Activity size={14} />
            <span>Executions & Analytics</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("heartbeat")}
            className={`pb-3 flex items-center gap-1.5 transition-colors border-b-2 -mb-px ${
              activeTab === "heartbeat"
                ? "border-emerald-500 text-emerald-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Terminal size={14} />
            <span>Heartbeat Setup</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("incidents")}
            className={`pb-3 flex items-center gap-1.5 transition-colors border-b-2 -mb-px ${
              activeTab === "incidents"
                ? "border-emerald-500 text-emerald-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <ShieldAlert size={14} />
            <span>Incident History</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("configuration")}
            className={`pb-3 flex items-center gap-1.5 transition-colors border-b-2 -mb-px ${
              activeTab === "configuration"
                ? "border-emerald-500 text-emerald-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Settings size={14} />
            <span>Configuration</span>
          </button>
        </div>

        {/* Tab 1: Executions & Analytics */}
        {activeTab === "executions" && (
          <div className="space-y-6">
            {/* Duration Chart Card */}
            <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Execution Duration Trend
                  </h3>
                  <p className="text-xs text-slate-500">
                    Duration history across recent execution runs.
                  </p>
                </div>
                {stats.avgDurationMs != null && (
                  <div className="text-right text-xs">
                    <span className="text-slate-400 block">Avg Duration</span>
                    <strong className="text-sm font-mono text-emerald-600">
                      {formatExecutionDuration(stats.avgDurationMs)}
                    </strong>
                  </div>
                )}
              </div>

              <JobDurationChart runs={runs} />
            </div>

            {/* Runs Table */}
            <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Execution History
                  </h3>
                  <p className="text-xs text-slate-500">
                    Full execution logs including exit codes, durations, and
                    diagnostics.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => refetchRuns()}
                  disabled={runsLoading}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                  title="Refresh runs"
                >
                  <RefreshCw
                    size={13}
                    className={runsLoading ? "animate-spin" : ""}
                  />
                </button>
              </div>

              <JobRunsTable
                runs={runs}
                loading={runsLoading}
                statusFilter={runStatusFilter}
                onStatusFilterChange={(s) => {
                  setRunStatusFilter(s);
                  setRunsPage(1);
                }}
                pagination={pagination}
                onPageChange={(p) => setRunsPage(p)}
              />
            </div>
          </div>
        )}

        {/* Tab 2: Heartbeat Integration */}
        {activeTab === "heartbeat" && snippets && (
          <div className="space-y-6">
            <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  How Heartbeat Monitoring Works
                </h3>
                <p className="text-xs text-slate-500">
                  Send HTTP POST requests from your script or cron runner to
                  signal execution state.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                  <b className="text-slate-800 block font-mono">
                    1. started
                  </b>
                  <p className="text-slate-600 text-[11px]">
                    Signals when your job execution begins. Tracks in-flight
                    status and execution timeouts.
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                  <b className="text-emerald-700 block font-mono">
                    2. succeeded
                  </b>
                  <p className="text-slate-600 text-[11px]">
                    Marks the execution as completed successfully and advances
                    the next scheduled run.
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                  <b className="text-rose-700 block font-mono">
                    3. failed
                  </b>
                  <p className="text-slate-600 text-[11px]">
                    Captures error message, exit code, and triggers an incident
                    if thresholds are breached.
                  </p>
                </div>
              </div>

              {/* Endpoint & Token Row */}
              <div className="space-y-3 pt-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 block">
                    Heartbeat URL
                  </label>
                  <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 shrink-0">
                      POST
                    </span>
                    <code className="text-xs font-mono text-slate-800 flex-1 truncate select-all">
                      {snippets.reportingUrl}
                    </code>
                    <button
                      type="button"
                      onClick={() =>
                        copyToClipboard(snippets.reportingUrl, "detail_url")
                      }
                      className="p-1 text-slate-500 hover:text-slate-800 shrink-0"
                    >
                      {copiedKey === "detail_url" ? (
                        <Check size={14} className="text-emerald-500" />
                      ) : (
                        <Copy size={14} />
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700">
                      Reporting Token Prefix
                    </label>
                    {canUpdate && (
                      <button
                        type="button"
                        onClick={() => rotateToken(jobId)}
                        disabled={submitting}
                        className="text-xs font-medium text-emerald-600 hover:underline flex items-center gap-1"
                      >
                        <RotateCw
                          size={11}
                          className={submitting ? "animate-spin" : ""}
                        />
                        <span>Rotate token (24h grace)</span>
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs font-mono">
                    <span className="text-slate-500">Prefix: </span>
                    <code className="text-slate-800">
                      {job.tokenPrefix}••••••••••••
                    </code>
                  </div>
                </div>
              </div>

              {/* cURL Snippet */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-slate-700">
                    cURL Snippet
                  </h4>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(snippets.curl, "curl_full")}
                    className="text-xs text-emerald-600 hover:underline flex items-center gap-1"
                  >
                    {copiedKey === "curl_full" ? (
                      <Check size={12} />
                    ) : (
                      <Copy size={12} />
                    )}
                    <span>
                      {copiedKey === "curl_full" ? "Copied" : "Copy cURL"}
                    </span>
                  </button>
                </div>
                <pre className="p-3.5 rounded-xl bg-slate-950 text-slate-200 text-xs font-mono overflow-x-auto leading-relaxed">
                  <code>{snippets.curl}</code>
                </pre>
              </div>

              {/* Node.js Snippet */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-slate-700">
                    Node.js Snippet
                  </h4>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(snippets.nodejs, "node_full")
                    }
                    className="text-xs text-emerald-600 hover:underline flex items-center gap-1"
                  >
                    {copiedKey === "node_full" ? (
                      <Check size={12} />
                    ) : (
                      <Copy size={12} />
                    )}
                    <span>
                      {copiedKey === "node_full" ? "Copied" : "Copy Node.js"}
                    </span>
                  </button>
                </div>
                <pre className="p-3.5 rounded-xl bg-slate-950 text-slate-200 text-xs font-mono overflow-x-auto leading-relaxed">
                  <code>{snippets.nodejs}</code>
                </pre>
              </div>

              {/* Python Snippet */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-slate-700">
                    Python Snippet
                  </h4>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(snippets.python, "python_full")
                    }
                    className="text-xs text-emerald-600 hover:underline flex items-center gap-1"
                  >
                    {copiedKey === "python_full" ? (
                      <Check size={12} />
                    ) : (
                      <Copy size={12} />
                    )}
                    <span>
                      {copiedKey === "python_full" ? "Copied" : "Copy Python"}
                    </span>
                  </button>
                </div>
                <pre className="p-3.5 rounded-xl bg-slate-950 text-slate-200 text-xs font-mono overflow-x-auto leading-relaxed">
                  <code>{snippets.python}</code>
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Incidents */}
        {activeTab === "incidents" && (
          <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Job Incidents
              </h3>
              <p className="text-xs text-slate-500">
                Incidents automatically opened when execution thresholds or
                deadlines are breached.
              </p>
            </div>

            <JobIncidentsList jobMonitorId={jobId} />
          </div>
        )}

        {/* Tab 4: Configuration */}
        {activeTab === "configuration" && (
          <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Schedule & Evaluation Settings
                </h3>
                <p className="text-xs text-slate-500">
                  Full timing, grace periods, and failure thresholds.
                </p>
              </div>
              {canUpdate && (
                <Button
                  variant="secondary"
                  onClick={() => setEditModalOpen(true)}
                >
                  <Pencil size={13} />
                  <span>Edit Configuration</span>
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-slate-400 block font-medium">
                  Schedule Type
                </span>
                <b className="text-sm capitalize font-semibold text-slate-800">
                  {job.scheduleType}
                </b>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-slate-400 block font-medium">
                  {job.scheduleType === "cron"
                    ? "Cron Expression"
                    : "Interval Seconds"}
                </span>
                <b className="text-sm font-mono font-semibold text-slate-800">
                  {job.scheduleType === "cron"
                    ? job.cronExpression
                    : `${job.intervalSeconds}s`}
                </b>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-slate-400 block font-medium">
                  Configured Timezone
                </span>
                <b className="text-sm font-semibold text-slate-800">
                  {job.timezone || "UTC"}
                </b>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-slate-400 block font-medium">
                  Grace Period
                </span>
                <b className="text-sm font-semibold text-slate-800">
                  {job.gracePeriodSeconds} seconds
                </b>
                <span className="text-[10px] text-slate-400 block">
                  Buffer before execution is marked missed
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-slate-400 block font-medium">
                  Execution Timeout
                </span>
                <b className="text-sm font-semibold text-slate-800">
                  {job.runTimeoutSeconds} seconds
                </b>
                <span className="text-[10px] text-slate-400 block">
                  Max duration before in-flight run times out
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-slate-400 block font-medium">
                  Thresholds
                </span>
                <b className="text-sm font-semibold text-slate-800">
                  {job.failureThreshold} fail / {job.recoveryThreshold} recovery
                </b>
                <span className="text-[10px] text-slate-400 block">
                  Incidents open after {job.failureThreshold} failures
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Edit Job Modal */}
      {editModalOpen && (
        <JobFormModal
          isOpen={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          onSubmit={async (payload) => {
            await updateJob(jobId, payload);
          }}
          initialData={job}
          submitting={submitting}
        />
      )}

      {/* Heartbeat Setup Modal */}
      {setupModalOpen && (
        <HeartbeatSetupModal
          isOpen={setupModalOpen}
          onClose={() => {
            setSetupModalOpen(false);
            setPlaintextToken(null);
          }}
          job={job}
          plaintextToken={plaintextToken}
          onRotateToken={async () => {
            await rotateToken(jobId);
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-rose-100 text-rose-600 shrink-0">
                <Trash2 size={20} />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900">
                  Delete &ldquo;{job.name}&rdquo;?
                </h3>
                <p className="text-xs text-slate-500 leading-normal">
                  Are you sure you want to delete this background job monitor?
                  All execution history, metrics, and associated incident
                  history will be permanently deleted.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(false)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteJob(jobId)}
                disabled={submitting}
                className="px-3.5 py-1.5 text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 rounded-lg disabled:opacity-50"
              >
                {submitting ? "Deleting..." : "Delete Job"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}
