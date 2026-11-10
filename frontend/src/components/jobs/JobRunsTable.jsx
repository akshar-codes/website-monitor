import { useState, Fragment } from "react";
import JobRunStatusBadge from "./JobRunStatusBadge.jsx";
import { formatExecutionDuration } from "../../utils/jobFormat.js";
import { formatRelative } from "../../utils/format.js";
import { format, parseISO } from "date-fns";
import {
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Terminal,
  Info,
} from "lucide-react";

export default function JobRunsTable({
  runs = [],
  loading = false,
  statusFilter = "all",
  onStatusFilterChange,
  pagination = null,
  onPageChange,
}) {
  const [expandedRunId, setExpandedRunId] = useState(null);

  const toggleExpand = (id) => {
    setExpandedRunId(expandedRunId === id ? null : id);
  };

  const formatDate = (date) => {
    if (!date) return "—";
    try {
      const d = typeof date === "string" ? parseISO(date) : new Date(date);
      return format(d, "MMM d, yyyy HH:mm:ss");
    } catch {
      return String(date);
    }
  };

  return (
    <div className="space-y-3" data-testid="job-runs-table">
      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
        <div className="flex items-center gap-1">
          {["all", "succeeded", "failed", "timed_out", "missed"].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onStatusFilterChange?.(s)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors capitalize ${
                statusFilter === s
                  ? "bg-slate-800 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {s.replace("_", " ")}
            </button>
          ))}
        </div>
        {pagination && (
          <span className="text-xs text-slate-400">
            Total {pagination.total} executions
          </span>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 font-semibold">
              <th className="py-2.5 px-3 w-8"></th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3">Run ID</th>
              <th className="py-2.5 px-3">Scheduled / Started</th>
              <th className="py-2.5 px-3">Duration</th>
              <th className="py-2.5 px-3">Completion</th>
              <th className="py-2.5 px-3">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && !runs.length ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-400">
                  Loading execution runs...
                </td>
              </tr>
            ) : !runs.length ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-400">
                  No execution runs found.
                </td>
              </tr>
            ) : (
              runs.map((run) => {
                const isExpanded = expandedRunId === run._id;
                const hasDetails =
                  run.errorMessage ||
                  run.failureReason ||
                  run.output ||
                  (run.metadata && Object.keys(run.metadata).length > 0) ||
                  run.exitCode !== undefined ||
                  run.delaySeconds;

                return (
                  <Fragment key={run._id || run.runId}>
                    <tr
                      onClick={() => hasDetails && toggleExpand(run._id)}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        hasDetails ? "cursor-pointer" : ""
                      }`}
                    >
                      <td className="py-2.5 px-3 text-slate-400">
                        {hasDetails && (
                          <span>
                            {isExpanded ? (
                              <ChevronDown size={14} />
                            ) : (
                              <ChevronRight size={14} />
                            )}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <JobRunStatusBadge status={run.status} />
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700 max-w-[140px] truncate">
                        {run.runId}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        <div>
                          {formatDate(run.startedAt || run.scheduledFor)}
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {formatRelative(run.startedAt || run.scheduledFor)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono font-medium text-slate-800">
                        {formatExecutionDuration(run.durationMs)}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">
                        {run.completedAt
                          ? formatDate(run.completedAt)
                          : "In flight"}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 truncate max-w-[180px]">
                        {run.errorMessage ? (
                          <span className="text-rose-600 truncate flex items-center gap-1 font-mono text-[11px]">
                            <AlertTriangle size={11} className="shrink-0" />
                            {run.errorMessage}
                          </span>
                        ) : run.exitCode !== undefined &&
                          run.exitCode !== null ? (
                          <span className="text-slate-400 font-mono text-[11px]">
                            Exit: {run.exitCode}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>

                    {/* Expandable Run Details Row */}
                    {isExpanded && (
                      <tr className="bg-slate-50/90 border-y border-slate-200">
                        <td colSpan={7} className="p-4 space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Failure Details */}
                            <div className="space-y-1.5">
                              <h4 className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                                <Info size={13} /> Execution Diagnostics
                              </h4>
                              <div className="p-2.5 rounded-lg bg-white border border-slate-200 text-xs space-y-1 font-mono">
                                <div>
                                  <span className="text-slate-400">
                                    Status:{" "}
                                  </span>
                                  <b className="uppercase">{run.status}</b>
                                </div>
                                {run.exitCode !== undefined &&
                                  run.exitCode !== null && (
                                    <div>
                                      <span className="text-slate-400">
                                        Exit Code:{" "}
                                      </span>
                                      <span>{run.exitCode}</span>
                                    </div>
                                  )}
                                {run.failureReason && (
                                  <div>
                                    <span className="text-slate-400">
                                      Failure Reason:{" "}
                                    </span>
                                    <span className="text-rose-600">
                                      {run.failureReason}
                                    </span>
                                  </div>
                                )}
                                {run.delaySeconds > 0 && (
                                  <div>
                                    <span className="text-slate-400">
                                      Delay past grace:{" "}
                                    </span>
                                    <span className="text-amber-600">
                                      {run.delaySeconds}s
                                    </span>
                                  </div>
                                )}
                                {run.errorMessage && (
                                  <div className="text-rose-600 pt-1 border-t border-slate-100">
                                    {run.errorMessage}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Metadata */}
                            {run.metadata &&
                              Object.keys(run.metadata).length > 0 && (
                                <div className="space-y-1.5">
                                  <h4 className="text-xs font-semibold text-slate-700">
                                    Custom Metadata
                                  </h4>
                                  <pre className="p-2.5 rounded-lg bg-white border border-slate-200 text-[11px] font-mono text-slate-700 overflow-x-auto max-h-32">
                                    {JSON.stringify(run.metadata, null, 2)}
                                  </pre>
                                </div>
                              )}
                          </div>

                          {/* Output Snippet */}
                          {run.output && (
                            <div className="space-y-1.5 pt-1">
                              <h4 className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                                <Terminal size={13} /> Console / Output Log
                              </h4>
                              <pre className="p-3 rounded-lg bg-slate-950 text-slate-200 text-xs font-mono overflow-x-auto max-h-48 whitespace-pre-wrap break-all leading-relaxed">
                                {run.output}
                              </pre>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-between text-xs text-slate-500 pt-2">
          <span>
            Page {pagination.page} of {pagination.pages}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={pagination.page <= 1}
              onClick={() => onPageChange?.(pagination.page - 1)}
              className="px-2.5 py-1 rounded border border-slate-200 hover:bg-slate-100 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={pagination.page >= pagination.pages}
              onClick={() => onPageChange?.(pagination.page + 1)}
              className="px-2.5 py-1 rounded border border-slate-200 hover:bg-slate-100 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
