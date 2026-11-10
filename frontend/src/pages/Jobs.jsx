import { useState, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { useJobList, useJobMutations } from "../hooks/useJobs.js";
import { useUsage } from "../hooks/useUsage.js";
import { usePermissions } from "../hooks/usePermissions.js";
import { jobDetailsPath } from "../constants/routes.js";
import { Page, Button } from "../components/ui/Primitives.jsx";
import JobStatusBadge from "../components/jobs/JobStatusBadge.jsx";
import JobRunStatusBadge from "../components/jobs/JobRunStatusBadge.jsx";
import JobFormModal from "../components/jobs/JobFormModal.jsx";
import HeartbeatSetupModal from "../components/jobs/HeartbeatSetupModal.jsx";
import {
  formatJobSchedule,
  formatExecutionDuration,
} from "../utils/jobFormat.js";
import { formatRelative } from "../utils/format.js";
import { format } from "date-fns";
import {
  Clock,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Pencil,
  Pause,
  Play,
  Terminal,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";

export default function Jobs() {
  const { can } = usePermissions();
  const canCreate = can("job-monitor:create");
  const canUpdate = can("job-monitor:update");
  const canDelete = can("job-monitor:delete");

  // Query & Filter State
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [scheduleTypeFilter, setScheduleTypeFilter] = useState("all");

  // Modals
  const [formOpen, setFormOpen] = useState(false);
  const [editingJob, setEditingJob] = useState(null);
  const [setupModalJob, setSetupModalJob] = useState(null);
  const [plaintextToken, setPlaintextToken] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { data: usageData } = useUsage();
  const usage = usageData?.data;
  const jobUsage = usage?.jobMonitors;

  const queryParams = useMemo(() => {
    const params = { page, limit: 20 };
    if (statusFilter !== "all") params.status = statusFilter;
    if (scheduleTypeFilter !== "all") params.scheduleType = scheduleTypeFilter;
    if (search.trim()) params.search = search.trim();
    return params;
  }, [page, statusFilter, scheduleTypeFilter, search]);

  const { data: jobsResponse, loading, refetch } = useJobList(queryParams);
  const jobs = useMemo(() => jobsResponse?.data || [], [jobsResponse]);
  const pagination = jobsResponse?.pagination;

  const handleMutationSuccess = useCallback(
    (action, result) => {
      refetch();
      if (action === "create") {
        setFormOpen(false);
        // Show token reveal setup dialog immediately
        if (result?.token) {
          setPlaintextToken(result.token);
          setSetupModalJob(result);
        }
      } else if (action === "update") {
        setFormOpen(false);
        setEditingJob(null);
      } else if (action === "delete") {
        setDeleteTarget(null);
      }
    },
    [refetch],
  );

  const {
    createJob,
    updateJob,
    deleteJob,
    togglePause,
    rotateToken,
    submitting,
  } = useJobMutations(handleMutationSuccess);

  // Summary Metrics Aggregation
  const metrics = useMemo(() => {
    let upCount = 0;
    let lateCount = 0;
    let downCount = 0;
    let activeIncidentCount = 0;

    jobs.forEach((job) => {
      if (job.status === "up") upCount++;
      else if (job.status === "late") lateCount++;
      else if (job.status === "down") downCount++;

      if (
        job.consecutiveFailures > 0 ||
        job.status === "down" ||
        job.status === "late"
      ) {
        activeIncidentCount++;
      }
    });

    return {
      total: pagination?.total ?? jobs.length,
      up: upCount,
      late: lateCount,
      down: downCount,
      activeIncidents: activeIncidentCount,
    };
  }, [jobs, pagination]);

  const handleCreateSubmit = async (payload) => {
    if (editingJob) {
      await updateJob(editingJob.id || editingJob._id, payload);
    } else {
      await createJob(payload);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    await deleteJob(deleteTarget.id || deleteTarget._id);
  };

  return (
    <Page
      eyebrow="Heartbeat Monitoring"
      title="Background Jobs & Tasks"
      description="Monitor cron jobs, database backups, periodic syncs, and microservice workers via secure heartbeat reporting."
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => refetch()}
            disabled={loading}
            title="Refresh jobs"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </Button>

          {canCreate && (
            <Button
              variant="primary"
              onClick={() => {
                setEditingJob(null);
                setFormOpen(true);
              }}
            >
              <Plus size={14} />
              <span>New Background Job</span>
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-6">
        {/* Usage & Plan Limits Notice */}
        {jobUsage && jobUsage.limit !== null && (
          <div className="flex flex-wrap items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 gap-2">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-emerald-500 shrink-0" />
              <span>
                Plan usage: <b className="text-slate-900">{jobUsage.used}</b> /{" "}
                {jobUsage.limit} background jobs configured
                {jobUsage.atLimit && (
                  <span className="ml-2 text-rose-600 font-semibold">
                    (Plan limit reached)
                  </span>
                )}
              </span>
            </div>
            {jobUsage.atLimit && (
              <Link
                to="/billing"
                className="text-emerald-600 font-semibold hover:underline flex items-center gap-1"
              >
                <span>Upgrade plan for more jobs</span>
                <ArrowRight size={12} />
              </Link>
            )}
          </div>
        )}

        {/* Metric Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs">
            <span className="text-xs text-slate-500 font-medium block">
              Total Monitored Jobs
            </span>
            <strong className="text-2xl font-bold text-slate-900 mt-1 block">
              {metrics.total}
            </strong>
          </div>
          <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs">
            <span className="text-xs text-emerald-600 font-medium block flex items-center gap-1">
              <CheckCircle2 size={13} /> Operational
            </span>
            <strong className="text-2xl font-bold text-emerald-600 mt-1 block">
              {metrics.up}
            </strong>
          </div>
          <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs">
            <span className="text-xs text-amber-600 font-medium block flex items-center gap-1">
              <Clock size={13} /> Late / Overdue
            </span>
            <strong className="text-2xl font-bold text-amber-600 mt-1 block">
              {metrics.late}
            </strong>
          </div>
          <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs">
            <span className="text-xs text-rose-600 font-medium block flex items-center gap-1">
              <AlertTriangle size={13} /> Failing / Down
            </span>
            <strong className="text-2xl font-bold text-rose-600 mt-1 block">
              {metrics.down}
            </strong>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-white border border-slate-200">
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[240px]">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[180px] max-w-sm">
              <Search
                size={14}
                className="absolute left-3 top-2.5 text-slate-400"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search jobs by name or description..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 text-slate-900"
            >
              <option value="all">All Statuses</option>
              <option value="up">Operational (Up)</option>
              <option value="late">Late</option>
              <option value="down">Down</option>
              <option value="pending">Awaiting Ping</option>
              <option value="paused">Paused</option>
            </select>

            {/* Schedule Type Filter */}
            <select
              value={scheduleTypeFilter}
              onChange={(e) => {
                setScheduleTypeFilter(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 text-slate-900"
            >
              <option value="all">All Schedules</option>
              <option value="cron">Cron Schedule</option>
              <option value="interval">Interval Schedule</option>
            </select>
          </div>
        </div>

        {/* Jobs List / Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 font-semibold">
                <th className="py-3 px-4">Job Name</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Schedule</th>
                <th className="py-3 px-3">Last Result</th>
                <th className="py-3 px-3">Next Expected</th>
                <th className="py-3 px-3">Incidents / Failures</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && !jobs.length ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <RefreshCw
                      size={20}
                      className="animate-spin mx-auto mb-2 text-emerald-500"
                    />
                    Loading background jobs...
                  </td>
                </tr>
              ) : !jobs.length ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <div className="max-w-sm mx-auto space-y-2">
                      <Clock size={28} className="mx-auto text-slate-300" />
                      <h3 className="text-sm font-semibold text-slate-800">
                        No background jobs configured
                      </h3>
                      <p className="text-xs text-slate-500">
                        Start tracking your cron jobs, database backups, and
                        scheduled workers with a secure heartbeat reporting
                        endpoint.
                      </p>
                      {canCreate && (
                        <div className="pt-2">
                          <Button
                            variant="primary"
                            onClick={() => {
                              setEditingJob(null);
                              setFormOpen(true);
                            }}
                          >
                            <Plus size={14} />
                            <span>Create Background Job</span>
                          </Button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                jobs.map((job) => {
                  const jobId = job.id || job._id;
                  const hasIncidents =
                    job.consecutiveFailures > 0 || job.consecutiveMissed > 0;

                  return (
                    <tr
                      key={jobId}
                      className="hover:bg-slate-50/70 transition-colors group"
                    >
                      {/* Job Name & Description */}
                      <td className="py-3 px-4">
                        <Link
                          to={jobDetailsPath(jobId)}
                          className="font-bold text-slate-900 hover:text-emerald-600 transition-colors block text-sm"
                        >
                          {job.name}
                        </Link>
                        {job.description && (
                          <span className="text-[11px] text-slate-400 truncate max-w-xs block">
                            {job.description}
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3">
                        <JobStatusBadge
                          status={job.status}
                          active={job.active}
                        />
                      </td>

                      {/* Schedule */}
                      <td className="py-3 px-3">
                        <span className="font-medium text-slate-700 block">
                          {formatJobSchedule(job)}
                        </span>
                        <span className="text-[10px] text-slate-400 uppercase font-mono">
                          {job.scheduleType} · {job.timezone}
                        </span>
                      </td>

                      {/* Last Result & Duration */}
                      <td className="py-3 px-3">
                        {job.lastRunStatus ? (
                          <div className="space-y-0.5">
                            <JobRunStatusBadge status={job.lastRunStatus} />
                            <div className="text-[10px] text-slate-400">
                              {job.lastDurationMs != null && (
                                <span className="font-mono">
                                  {formatExecutionDuration(job.lastDurationMs)}{" "}
                                  ·{" "}
                                </span>
                              )}
                              <span>
                                {job.lastPingAt
                                  ? formatRelative(job.lastPingAt)
                                  : "—"}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">
                            No runs yet
                          </span>
                        )}
                      </td>

                      {/* Next Expected */}
                      <td className="py-3 px-3">
                        {job.active && job.nextExpectedAt ? (
                          <div>
                            <span className="font-medium text-slate-700 block">
                              {formatRelative(job.nextExpectedAt)}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {format(
                                new Date(job.nextExpectedAt),
                                "MMM d, HH:mm",
                              )}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">Paused</span>
                        )}
                      </td>

                      {/* Incidents / Failures */}
                      <td className="py-3 px-3">
                        {hasIncidents ? (
                          <div className="space-y-0.5">
                            {job.consecutiveFailures > 0 && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600">
                                <AlertTriangle size={11} />{" "}
                                {job.consecutiveFailures} failure(s)
                              </span>
                            )}
                            {job.consecutiveMissed > 0 && (
                              <span className="text-[10px] text-amber-600 block">
                                {job.consecutiveMissed} missed
                              </span>
                            )}
                            <Link
                              to={`/incidents?jobMonitorId=${jobId}`}
                              className="text-[10px] text-emerald-600 hover:underline block"
                            >
                              View incidents →
                            </Link>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">Clean</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1 opacity-90 group-hover:opacity-100 transition-opacity">
                          {/* Heartbeat setup snippet */}
                          <button
                            type="button"
                            onClick={() => {
                              setPlaintextToken(null);
                              setSetupModalJob(job);
                            }}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                            title="Heartbeat Setup & API Token"
                          >
                            <Terminal size={14} />
                          </button>

                          {/* Pause / Resume */}
                          {canUpdate && (
                            <button
                              type="button"
                              onClick={() => togglePause(jobId)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                              title={
                                job.active
                                  ? "Pause job monitoring"
                                  : "Resume job monitoring"
                              }
                            >
                              {job.active ? (
                                <Pause size={14} />
                              ) : (
                                <Play size={14} />
                              )}
                            </button>
                          )}

                          {/* Edit */}
                          {canUpdate && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingJob(job);
                                setFormOpen(true);
                              }}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                              title="Edit job configuration"
                            >
                              <Pencil size={14} />
                            </button>
                          )}

                          {/* Delete */}
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(job)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                              title="Delete background job"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {pagination && pagination.pages > 1 && (
          <div className="flex items-center justify-between text-xs text-slate-500 pt-2">
            <span>
              Showing page {pagination.page} of {pagination.pages} (
              {pagination.total} total)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={pagination.page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={pagination.page >= pagination.pages}
                onClick={() =>
                  setPage((p) => Math.min(pagination.pages, p + 1))
                }
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {formOpen && (
        <JobFormModal
          isOpen={formOpen}
          onClose={() => {
            setFormOpen(false);
            setEditingJob(null);
          }}
          onSubmit={handleCreateSubmit}
          initialData={editingJob}
          submitting={submitting}
        />
      )}

      {/* Heartbeat Setup & One-Time Token Reveal Modal */}
      {setupModalJob && (
        <HeartbeatSetupModal
          isOpen={Boolean(setupModalJob)}
          onClose={() => {
            setSetupModalJob(null);
            setPlaintextToken(null);
          }}
          job={setupModalJob}
          plaintextToken={plaintextToken}
          onRotateToken={async (id) => {
            const res = await rotateToken(id);
            if (res?.token) {
              setPlaintextToken(res.token);
            }
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deleteTarget && (
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
                  Delete &ldquo;{deleteTarget.name}&rdquo;?
                </h3>
                <p className="text-xs text-slate-500 leading-normal">
                  This will permanently delete this job monitor, all execution
                  run history, and any associated incidents. Heartbeat requests
                  using its reporting token will be rejected.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
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
