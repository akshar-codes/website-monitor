import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { History, RefreshCw, ShieldAlert } from "lucide-react";
import PageContainer from "../components/layout/PageContainer";
import PageHeader from "../components/layout/PageHeader";
import Button from "../components/ui/Button";
import EmptyState from "../components/ui/EmptyState";
import Pagination from "../components/ui/Pagination";
import { SkeletonRow } from "../components/ui/Skeleton";
import { Input, Select } from "../components/ui/Input";
import { useAdminAuditEvents } from "../hooks/useAdmin";

const field =
  "rounded-lg border border-border-default bg-bg-elevated px-3 py-2 text-sm text-zinc-200 outline-none focus:border-emerald-500";
const resourceUrl = (target) => {
  if (!target?.id) return null;
  if (target.type === "User") return `/admin/users/${target.id}`;
  if (target.type === "Monitor") return `/admin/monitors/${target.id}`;
  if (target.type === "Incident") return `/admin/incidents/${target.id}`;
  if (target.type === "PlanUpgradeRequest") return `/admin/plan-requests`;
  return null;
};
const eventLabel = (event) => event.eventType.replaceAll("_", " ");

export default function AdminAuditLogs() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [outcome, setOutcome] = useState("");
  const [actorId, setActorId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const params = useMemo(
    () => ({
      page,
      limit: 25,
      ...(search.trim() ? { search: search.trim() } : {}),
      ...(category ? { category } : {}),
      ...(outcome ? { outcome } : {}),
      ...(actorId.trim() ? { actorId: actorId.trim() } : {}),
      ...(targetId.trim() ? { targetId: targetId.trim() } : {}),
      ...(startDate && endDate
        ? {
            startDate: new Date(`${startDate}T00:00:00.000Z`).toISOString(),
            endDate: new Date(`${endDate}T23:59:59.999Z`).toISOString(),
          }
        : {}),
    }),
    [page, search, category, outcome, actorId, targetId, startDate, endDate],
  );
  const { data, loading, error, refetch } = useAdminAuditEvents(params);
  const events = data?.data || [];
  const resetPage = (setter) => (value) => {
    setter(value);
    setPage(1);
  };
  return (
    <PageContainer>
      <PageHeader
        title="Audit & security"
        subtitle="Read-only record of administrative actions and account security events"
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
        className="mb-5"
      />
      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          placeholder="Search actions"
          value={search}
          onChange={(e) => resetPage(setSearch)(e.target.value)}
        />
        <Select
          value={category}
          onChange={(e) => resetPage(setCategory)(e.target.value)}
        >
          <option value="">Admin + security events</option>
          <option value="admin">Administrative actions</option>
          <option value="auth">Authentication events</option>
          <option value="session">Session security events</option>
        </Select>
        <Select
          value={outcome}
          onChange={(e) => resetPage(setOutcome)(e.target.value)}
        >
          <option value="">All outcomes</option>
          <option value="success">Successful</option>
          <option value="failure">Failed</option>
        </Select>
        <Input
          aria-label="Actor user ID"
          placeholder="Actor user ID"
          value={actorId}
          onChange={(e) => resetPage(setActorId)(e.target.value)}
        />
        <Input
          aria-label="Target resource ID"
          placeholder="Target user/resource ID"
          value={targetId}
          onChange={(e) => resetPage(setTargetId)(e.target.value)}
        />
        <label className="flex items-center gap-2 text-xs text-zinc-500">
          From{" "}
          <input
            className={field}
            type="date"
            value={startDate}
            onChange={(e) => resetPage(setStartDate)(e.target.value)}
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-zinc-500">
          To{" "}
          <input
            className={field}
            type="date"
            value={endDate}
            onChange={(e) => resetPage(setEndDate)(e.target.value)}
          />
        </label>
        {(startDate || endDate) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStartDate("");
              setEndDate("");
              setPage(1);
            }}
          >
            Clear dates
          </Button>
        )}
      </div>
      {Boolean(startDate) !== Boolean(endDate) && (
        <p className="mb-3 text-xs text-amber-400">
          Choose both dates to filter a date range.
        </p>
      )}
      {error && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-300"
        >
          Audit events could not be loaded.{" "}
          <button onClick={refetch} className="underline">
            Retry
          </button>
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border border-border-subtle bg-bg-surface">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead>
            <tr className="border-b border-border-subtle text-[11px] uppercase text-text-disabled">
              <th className="px-4 py-3">Event</th>
              <th className="px-4 py-3">Actor</th>
              <th className="px-4 py-3">Target</th>
              <th className="px-4 py-3">Outcome</th>
              <th className="px-4 py-3">Timestamp</th>
              <th className="px-4 py-3">Details</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 6 }, (_, i) => (
                  <tr key={i}>
                    <td colSpan="6">
                      <SkeletonRow />
                    </td>
                  </tr>
                ))
              : events.map((event) => (
                  <tr
                    key={event.id}
                    className="border-b border-zinc-800/70 align-top"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] capitalize ${event.securityRelated ? "border-amber-500/20 bg-amber-500/10 text-amber-300" : "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"}`}
                        >
                          {event.securityRelated ? (
                            <ShieldAlert size={11} className="mr-1 inline" />
                          ) : null}
                          {event.category}
                        </span>
                        <span className="capitalize text-zinc-200">
                          {eventLabel(event)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-zinc-500">
                        {event.description}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-zinc-300">
                      {event.actor?.name || "Former user"}
                      <p className="text-xs text-zinc-500">
                        {event.actor?.email || "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {event.target ? (
                        resourceUrl(event.target) ? (
                          <Link
                            className="text-emerald-400 hover:text-emerald-300"
                            to={resourceUrl(event.target)}
                          >
                            {event.target.name || event.target.type}
                            <p className="text-xs text-zinc-500">
                              {event.target.email || event.target.id}
                            </p>
                          </Link>
                        ) : (
                          <span className="text-zinc-400">
                            {event.target.name || event.target.type}
                            <p className="text-xs text-zinc-500">
                              {event.target.id}
                            </p>
                          </span>
                        )
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-1 text-[11px] ${event.outcome === "failure" ? "bg-red-500/10 text-red-300" : "bg-emerald-500/10 text-emerald-300"}`}
                      >
                        {event.outcome}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500">
                      {new Date(event.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <details>
                        <summary className="cursor-pointer text-xs text-emerald-400">
                          View safe metadata
                        </summary>
                        <pre className="mt-2 max-w-sm overflow-auto rounded bg-black/30 p-2 text-[11px] text-zinc-400">
                          {JSON.stringify(event.metadata, null, 2)}
                        </pre>
                      </details>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
        {!loading && !events.length && (
          <EmptyState
            icon={History}
            title="No audit events found"
            description="Try clearing filters or widening the date range."
          />
        )}
      </div>
      {data?.pagination?.totalPages > 1 && (
        <Pagination
          page={data.pagination.page}
          totalPages={data.pagination.totalPages}
          onPageChange={setPage}
          className="mt-4"
        />
      )}
      <p className="mt-4 text-xs text-zinc-600">
        Audit records are read-only here. Historical events without an explicit
        outcome are displayed as successful actions.
      </p>
    </PageContainer>
  );
}
