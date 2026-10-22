import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, RefreshCw } from "lucide-react";
import PageContainer from "../components/layout/PageContainer";
import PageHeader from "../components/layout/PageHeader";
import Button from "../components/ui/Button";
import EmptyState from "../components/ui/EmptyState";
import { useAdminIncident, useResolveAdminIncident } from "../hooks/useAdmin";

const panel = "rounded-xl border border-border-subtle bg-bg-surface p-5";
export default function AdminIncidentDetails() {
  const { id } = useParams();
  const [confirm, setConfirm] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [rootCause, setRootCause] = useState("");
  const { data, loading, error, refetch } = useAdminIncident(id);
  const onDone = () => {
    setConfirm(false);
    refetch();
  };
  const { resolve, submitting } = useResolveAdminIncident(onDone);
  return (
    <PageContainer>
      <PageHeader
        title="Incident investigation"
        subtitle="Review incident status, timeline, and trigger check"
        actions={
          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            onClick={refetch}
          >
            Refresh
          </Button>
        }
        className="mb-4"
      />
      <Link
        to="/admin/incidents"
        className="mb-4 inline-flex items-center gap-2 text-sm text-emerald-400"
      >
        <ArrowLeft size={15} />
        Back to incident oversight
      </Link>
      {error && (
        <p role="alert" className="my-4 text-sm text-red-300">
          Incident could not be loaded.{" "}
          <button onClick={refetch} className="underline">
            Retry
          </button>
        </p>
      )}
      {loading && !data ? (
        <div className={`${panel} h-48 animate-pulse`} />
      ) : (
        data && (
          <>
            <section className={`${panel} my-4`}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    {data.monitor?.name || "Monitor unavailable"}
                  </h2>
                  <p className="text-sm text-zinc-500">{data.monitor?.url}</p>
                  <p className="mt-2 text-sm text-zinc-400">
                    Owner: {data.monitor?.owner?.name} ·{" "}
                    {data.monitor?.owner?.email} · {data.monitor?.owner?.plan}
                  </p>
                </div>
                <div className="text-right">
                  <p className="capitalize text-emerald-400">
                    {data.severity} · {data.status}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Started {new Date(data.startedAt).toLocaleString()}
                  </p>
                  <p className="text-xs text-zinc-500">
                    Duration{" "}
                    {data.duration == null
                      ? "Unavailable"
                      : `${data.duration}s`}
                  </p>
                </div>
              </div>
              {data.rootCause && (
                <p className="mt-4 text-sm text-zinc-300">
                  Root cause: {data.rootCause}
                </p>
              )}
              {data.resolutionNotes && (
                <p className="mt-2 text-sm text-zinc-400">
                  Resolution: {data.resolutionNotes}
                </p>
              )}
              {data.status !== "resolved" && (
                <Button
                  className="mt-4"
                  variant="primary"
                  onClick={() => setConfirm(true)}
                >
                  Resolve incident
                </Button>
              )}
            </section>
            <section className={panel}>
              <h2 className="mb-4 text-sm font-semibold text-white">
                Incident timeline
              </h2>
              {data.statusHistory?.length ? (
                data.statusHistory.map((entry, index) => (
                  <div
                    key={`${entry.changedAt}-${index}`}
                    className="border-l border-emerald-500/30 py-2 pl-4"
                  >
                    <p className="text-sm capitalize text-zinc-200">
                      {entry.status}
                    </p>
                    <time className="text-xs text-zinc-500">
                      {new Date(entry.changedAt).toLocaleString()}
                    </time>
                  </div>
                ))
              ) : (
                <EmptyState title="No timeline entries" />
              )}
              <div className="mt-5 border-t border-zinc-800 pt-4">
                <h3 className="text-sm font-medium text-white">
                  Trigger health check
                </h3>
                {data.triggerCheck ? (
                  <p className="mt-2 text-sm text-zinc-400">
                    {data.triggerCheck.status} · HTTP{" "}
                    {data.triggerCheck.httpStatus || "—"} ·{" "}
                    {data.triggerCheck.responseTime} ms ·{" "}
                    {data.triggerCheck.failureReason || "No failure"}
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-zinc-500">
                    No trigger check is attached.
                  </p>
                )}
              </div>
            </section>
          </>
        )
      )}
      {confirm && (
        <div
          className="fixed inset-0 z-[60] grid place-items-center bg-black/70"
          onClick={(e) => {
            if (e.target === e.currentTarget) setConfirm(false);
          }}
        >
          <div className="w-[min(92vw,480px)] rounded-xl border border-zinc-700 bg-[#111113] p-5">
            <h2 className="font-semibold text-white">Resolution details</h2>
            <label className="mt-4 block text-sm text-zinc-300">
              Resolution notes
              <textarea
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-black/30 p-3 text-sm text-white"
                rows={3}
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
              />
            </label>
            <label className="mt-3 block text-sm text-zinc-300">
              Root cause (optional)
              <textarea
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-black/30 p-3 text-sm text-white"
                rows={2}
                value={rootCause}
                onChange={(e) => setRootCause(e.target.value)}
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setConfirm(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                disabled={resolutionNotes.trim().length < 3 || submitting}
                loading={submitting}
                onClick={() =>
                  resolve(id, {
                    resolutionNotes: resolutionNotes.trim(),
                    ...(rootCause.trim()
                      ? { rootCause: rootCause.trim() }
                      : {}),
                  })
                }
              >
                Resolve incident
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
