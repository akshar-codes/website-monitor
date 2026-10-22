import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Monitor as MonitorIcon, RefreshCw } from "lucide-react";
import PageContainer from "../components/layout/PageContainer";
import PageHeader from "../components/layout/PageHeader";
import Button from "../components/ui/Button";
import EmptyState from "../components/ui/EmptyState";
import Pagination from "../components/ui/Pagination";
import { SkeletonRow } from "../components/ui/Skeleton";
import { Input, Select } from "../components/ui/Input";
import { useAdminMonitors } from "../hooks/useAdmin";

export default function AdminMonitors() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [plan, setPlan] = useState("");
  const [status, setStatus] = useState("");
  const [incidentState, setIncidentState] = useState("");
  const params = useMemo(
    () => ({
      page,
      limit: 20,
      ...(search.trim() ? { search: search.trim() } : {}),
      ...(ownerId.trim() ? { ownerId: ownerId.trim() } : {}),
      ...(plan ? { plan } : {}),
      ...(status ? { status } : {}),
      ...(incidentState ? { incidentState } : {}),
    }),
    [page, search, ownerId, plan, status, incidentState],
  );
  const { data, loading, error, refetch } = useAdminMonitors(params);
  const rows = data?.data || [];
  return (
    <PageContainer>
      <PageHeader
        title="Monitor oversight"
        subtitle="Inspect monitors across user accounts"
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
      <div className="mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        <Input
          aria-label="Search monitors"
          placeholder="Search name or URL"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <Input
          aria-label="Owner ID"
          placeholder="Owner ID"
          value={ownerId}
          onChange={(e) => {
            setOwnerId(e.target.value);
            setPage(1);
          }}
        />
        <Select
          value={plan}
          onChange={(e) => {
            setPlan(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All plans</option>
          <option value="free">Free</option>
          <option value="pro">Pro</option>
          <option value="unlimited">Unlimited</option>
        </Select>
        <Select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Any health / state</option>
          <option value="active">Enabled</option>
          <option value="paused">Paused</option>
          <option value="up">Up</option>
          <option value="down">Down</option>
          <option value="degraded">Degraded</option>
          <option value="unknown">Unknown</option>
        </Select>
        <Select
          value={incidentState}
          onChange={(e) => {
            setIncidentState(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Any incident state</option>
          <option value="active">Active incident</option>
          <option value="resolved">Has resolved incident</option>
          <option value="none">No active incident</option>
        </Select>
      </div>
      {error && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-300"
        >
          Monitor list could not be loaded.{" "}
          <button onClick={refetch} className="underline">
            Retry
          </button>
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border border-border-subtle bg-bg-surface">
        <table className="w-full min-w-[850px] text-left text-sm">
          <thead>
            <tr className="border-b border-border-subtle text-[11px] uppercase text-text-disabled">
              <th className="px-4 py-3">Monitor</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Health</th>
              <th className="px-4 py-3">Last checked</th>
              <th className="px-4 py-3">Incidents</th>
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
              : rows.map((m) => (
                  <tr key={m.id} className="border-b border-zinc-800/70">
                    <td className="px-4 py-3">
                      <Link
                        to={`/admin/monitors/${m.id}`}
                        className="font-medium text-zinc-200 hover:text-emerald-400"
                      >
                        {m.name}
                      </Link>
                      <p className="max-w-xs truncate text-xs text-zinc-500">
                        {m.url}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-zinc-300">
                      {m.owner?.name || "Unknown owner"}
                      <p className="text-xs text-zinc-500">{m.owner?.email}</p>
                    </td>
                    <td className="px-4 py-3 capitalize text-zinc-400">
                      {m.owner?.plan || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="capitalize text-zinc-300">
                        {m.latestCheck?.status ||
                          (m.active ? "unknown" : "paused")}
                      </span>
                      {m.latestCheck?.failureReason && (
                        <p className="text-xs text-red-400">
                          {m.latestCheck.failureReason}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500">
                      {m.latestCheck?.checkedAt
                        ? new Date(m.latestCheck.checkedAt).toLocaleString()
                        : "Never"}
                    </td>
                    <td className="px-4 py-3 text-zinc-400">
                      {m.hasActiveIncident ? "Active" : "None active"}
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
        {!loading && !rows.length && (
          <EmptyState
            icon={MonitorIcon}
            title="No monitors found"
            description="Try changing or clearing the filters."
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
    </PageContainer>
  );
}
