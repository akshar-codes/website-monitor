import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, RefreshCw, Zap } from "lucide-react";
import PageContainer from "../components/layout/PageContainer";
import PageHeader from "../components/layout/PageHeader";
import Button from "../components/ui/Button";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import EmptyState from "../components/ui/EmptyState";
import { Select } from "../components/ui/Input";
import { useAdminMonitor, useAdminMonitorCheck } from "../hooks/useAdmin";

const panel = "rounded-xl border border-border-subtle bg-bg-surface p-5";
export default function AdminMonitorDetails() {
  const { id } = useParams();
  const [window, setWindow] = useState("30d");
  const [confirm, setConfirm] = useState(false);
  const { data, loading, error, refetch } = useAdminMonitor(id, window);
  const onCheck = () => {
    setConfirm(false);
    refetch();
  };
  const { check, submitting } = useAdminMonitorCheck(onCheck);
  const monitor = data?.monitor;
  return (
    <PageContainer>
      <PageHeader
        title={monitor?.name || "Monitor investigation"}
        subtitle={monitor?.url}
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              icon={RefreshCw}
              onClick={refetch}
            >
              Refresh
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={Zap}
              onClick={() => setConfirm(true)}
            >
              Manual check
            </Button>
          </>
        }
        className="mb-4"
      />
      <Link
        to="/admin/monitors"
        className="mb-4 inline-flex items-center gap-2 text-sm text-emerald-400"
      >
        <ArrowLeft size={15} />
        Back to monitor oversight
      </Link>
      {error && (
        <div
          role="alert"
          className="my-4 rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-300"
        >
          Monitor details failed to load.{" "}
          <button onClick={refetch} className="underline">
            Retry
          </button>
        </div>
      )}
      {loading && !data ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`${panel} h-36 animate-pulse`} />
          ))}
        </div>
      ) : (
        data && (
          <>
            <div className="my-4 grid gap-4 md:grid-cols-3">
              <section className={panel}>
                <h2 className="text-sm font-semibold text-white">
                  Owner and configuration
                </h2>
                <p className="mt-3 text-sm text-zinc-300">
                  {monitor.owner?.name} · {monitor.owner?.email}
                </p>
                <p className="mt-1 text-xs capitalize text-zinc-500">
                  {monitor.owner?.plan} plan ·{" "}
                  {monitor.active ? "Enabled" : "Paused"}
                </p>
                <p className="mt-3 text-sm text-zinc-400">
                  Every {monitor.interval}s · SSL{" "}
                  {monitor.sslMonitoringEnabled ? "enabled" : "disabled"}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Created {new Date(monitor.createdAt).toLocaleString()}
                </p>
              </section>
              <section className={panel}>
                <h2 className="text-sm font-semibold text-white">
                  Uptime · {window}
                </h2>
                <Select
                  className="mt-3"
                  value={window}
                  onChange={(e) => setWindow(e.target.value)}
                >
                  <option value="24h">24 hours</option>
                  <option value="7d">7 days</option>
                  <option value="30d">30 days</option>
                  <option value="90d">90 days</option>
                </Select>
                <p className="mt-3 text-2xl font-semibold text-emerald-400">
                  {data.uptime.uptimePercentage == null
                    ? "—"
                    : `${data.uptime.uptimePercentage}%`}
                </p>
                <p className="text-xs text-zinc-500">
                  {data.uptime.totalChecks} checks · {data.uptime.failedChecks}{" "}
                  failed · {Math.round(data.uptime.averageResponseTime || 0)} ms
                  average · {data.uptime.downtimeSeconds}s downtime
                </p>
              </section>
              <section className={panel}>
                <h2 className="text-sm font-semibold text-white">
                  Recent failures
                </h2>
                {data.recentChecks
                  .filter((c) => c.status === "down" || c.status === "degraded")
                  .slice(0, 5)
                  .map((c) => (
                    <p key={c.id} className="mt-2 text-xs text-red-300">
                      {new Date(c.checkedAt).toLocaleString()} ·{" "}
                      {c.failureReason || c.status}
                    </p>
                  ))}
                {!data.recentChecks.some(
                  (c) => c.status === "down" || c.status === "degraded",
                ) && (
                  <p className="mt-3 text-sm text-zinc-500">
                    No recent failures.
                  </p>
                )}
              </section>
            </div>
            <section className={`${panel} mb-4`}>
              <h2 className="mb-3 text-sm font-semibold text-white">
                Recent health checks
              </h2>
              {data.recentChecks.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px] text-left text-sm">
                    <thead>
                      <tr className="text-xs uppercase text-zinc-500">
                        <th className="py-2">Checked</th>
                        <th>Status</th>
                        <th>HTTP</th>
                        <th>Response</th>
                        <th>Failure</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentChecks.map((c) => (
                        <tr key={c.id} className="border-t border-zinc-800">
                          <td className="py-2 text-xs text-zinc-400">
                            {new Date(c.checkedAt).toLocaleString()}
                          </td>
                          <td className="capitalize text-zinc-300">
                            {c.status}
                          </td>
                          <td className="text-zinc-400">
                            {c.httpStatus || "—"}
                          </td>
                          <td className="text-zinc-400">{c.responseTime} ms</td>
                          <td className="text-red-300">
                            {c.failureReason || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState title="No health checks yet" />
              )}
            </section>
            <section className={panel}>
              <h2 className="mb-3 text-sm font-semibold text-white">
                Incident history
              </h2>
              {data.incidentHistory.length ? (
                data.incidentHistory.map((i) => (
                  <div key={i.id} className="border-t border-zinc-800 py-3">
                    <Link
                      to={`/admin/incidents/${i.id}`}
                      className="text-sm capitalize text-emerald-400"
                    >
                      {i.severity} · {i.status}
                    </Link>
                    <p className="mt-1 text-xs text-zinc-500">
                      {new Date(i.startedAt).toLocaleString()}{" "}
                      {i.endedAt
                        ? `– ${new Date(i.endedAt).toLocaleString()}`
                        : "· ongoing"}{" "}
                      ·{" "}
                      {i.duration ??
                        Math.floor(
                          (Date.now() - new Date(i.startedAt).getTime()) / 1000,
                        )}
                      s
                    </p>
                    {i.rootCause && (
                      <p className="mt-1 text-sm text-zinc-400">
                        {i.rootCause}
                      </p>
                    )}
                  </div>
                ))
              ) : (
                <EmptyState
                  title="No incidents"
                  description="This monitor has no recorded incidents."
                />
              )}
            </section>
            {data?.recentChecks[0]?.diagnostics && (
              <section className={`${panel} mb-4`}>
                <h2 className="mb-3 text-sm font-semibold text-white">
                  Latest diagnostic details
                </h2>
                <p className="text-xs text-zinc-500">
                  Final URL: {data.recentChecks[0].diagnostics.finalUrl || "—"}
                </p>
                <p className="mt-2 text-xs text-zinc-500">
                  DNS:{" "}
                  {data.recentChecks[0].diagnostics.dns?.addresses
                    ?.map((item) => item.address)
                    .join(", ") ||
                    data.recentChecks[0].diagnostics.dns?.error ||
                    "—"}
                </p>
                {data.recentChecks[0].diagnostics.redirects?.length > 0 && (
                  <p className="mt-2 text-xs text-zinc-500">
                    Redirects:{" "}
                    {data.recentChecks[0].diagnostics.redirects
                      .map(
                        (item) =>
                          `${item.status} ${item.url} → ${item.location}`,
                      )
                      .join(" · ")}
                  </p>
                )}
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs text-emerald-400">
                    Safe response headers
                  </summary>
                  <pre className="mt-2 max-h-56 overflow-auto rounded-lg bg-black/30 p-3 text-xs text-zinc-400">
                    {JSON.stringify(
                      data.recentChecks[0].diagnostics.headers,
                      null,
                      2,
                    )}
                  </pre>
                </details>
              </section>
            )}
          </>
        )
      )}
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={() => check(id)}
        title="Trigger a health check?"
        description="This runs the existing monitoring pipeline and records its real result. Incident thresholds remain unchanged."
        confirmLabel="Run check"
        loading={submitting}
      />
    </PageContainer>
  );
}
