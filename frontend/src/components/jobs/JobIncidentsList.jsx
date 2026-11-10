import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getIncidents } from "../../services/api/incidents.js";
import { formatRelative, formatDuration } from "../../utils/format.js";
import { AlertTriangle, CheckCircle, Clock, ArrowRight } from "lucide-react";

export default function JobIncidentsList({ jobMonitorId }) {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [prevJobMonitorId, setPrevJobMonitorId] = useState(jobMonitorId);

  if (jobMonitorId !== prevJobMonitorId) {
    setPrevJobMonitorId(jobMonitorId);
    setLoading(true);
  }

  useEffect(() => {
    if (!jobMonitorId) return;
    let active = true;

    getIncidents({ jobMonitorId, limit: 20 })
      .then((res) => {
        if (!active) return;
        setIncidents(res?.data || []);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || "Failed to load incidents");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [jobMonitorId]);

  if (loading) {
    return (
      <div className="p-8 text-center text-xs text-slate-400">
        Loading incident history...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-xl bg-rose-50 text-rose-700 text-xs border border-rose-200">
        {error}
      </div>
    );
  }

  if (!incidents.length) {
    return (
      <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl space-y-1">
        <CheckCircle size={20} className="text-emerald-500 mx-auto mb-2" />
        <span className="font-semibold text-slate-700 block">
          No Incidents Recorded
        </span>
        <p>This background job has not experienced any triggered incidents.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="job-incidents-list">
      {incidents.map((incident) => {
        const isResolved = incident.status === "resolved";
        const severityClass =
          incident.severity === "critical"
            ? "border-rose-500 text-rose-700 bg-rose-50/70"
            : incident.severity === "minor"
              ? "border-amber-500 text-amber-700 bg-amber-50/70"
              : "border-orange-500 text-orange-700 bg-orange-50/70";

        return (
          <div
            key={incident.id || incident._id}
            className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-2.5 transition-all hover:border-slate-300"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${severityClass}`}
                  >
                    <AlertTriangle size={10} />
                    {incident.severity}
                  </span>
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      isResolved
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-rose-100 text-rose-800 animate-pulse"
                    }`}
                  >
                    {isResolved ? "Resolved" : incident.status.toUpperCase()}
                  </span>
                </div>
                <h4 className="text-sm font-semibold text-slate-900">
                  {incident.rootCause || "Job execution failure detected"}
                </h4>
              </div>

              <Link
                to={`/incidents`}
                className="text-xs font-medium text-emerald-600 hover:underline flex items-center gap-1 shrink-0"
              >
                <span>View all incidents</span>
                <ArrowRight size={12} />
              </Link>
            </div>

            <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-500 pt-1 border-t border-slate-100">
              <span className="flex items-center gap-1">
                <Clock size={12} />
                Started:{" "}
                {incident.startedAt ? formatRelative(incident.startedAt) : "—"}
              </span>
              {isResolved && incident.duration != null && (
                <span>
                  Duration:{" "}
                  <b className="font-semibold text-slate-700">
                    {formatDuration(incident.duration)}
                  </b>
                </span>
              )}
              {incident.triggerJobRun && (
                <span className="font-mono text-[11px] text-slate-600">
                  Trigger Run:{" "}
                  {incident.triggerJobRun.runId || incident.triggerJobRun}
                </span>
              )}
            </div>

            {incident.resolutionNotes && (
              <div className="p-2 rounded bg-slate-50 text-xs text-slate-600">
                <span className="font-medium text-slate-700">
                  Resolution:{" "}
                </span>
                {incident.resolutionNotes}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
