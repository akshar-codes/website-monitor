import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, RefreshCw } from "lucide-react";
import PageContainer from "../components/layout/PageContainer";
import PageHeader from "../components/layout/PageHeader";
import Button from "../components/ui/Button";
import EmptyState from "../components/ui/EmptyState";
import Pagination from "../components/ui/Pagination";
import { SkeletonRow } from "../components/ui/Skeleton";
import { Input, Select } from "../components/ui/Input";
import { useAdminIncidents } from "../hooks/useAdmin";

export default function AdminIncidents() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState("");
  const [status, setStatus] = useState("");
  const params = useMemo(
    () => ({
      page,
      limit: 20,
      ...(search.trim() ? { search: search.trim() } : {}),
      ...(severity ? { severity } : {}),
      ...(status ? { status } : {}),
    }),
    [page, search, severity, status],
  );
  const { data, loading, error, refetch } = useAdminIncidents(params);
  const incidents = data?.data || [];
  return (
    <PageContainer>
      <PageHeader
        title="Incident oversight"
        subtitle="Investigate incidents across monitored accounts"
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
      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        <Input
          placeholder="Search monitor, root cause, or notes"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <Select
          value={severity}
          onChange={(e) => {
            setSeverity(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All severities</option>
          <option value="critical">Critical</option>
          <option value="major">Major</option>
          <option value="minor">Minor</option>
        </Select>
        <Select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          <option value="ongoing">Ongoing</option>
          <option value="investigating">Investigating</option>
          <option value="identified">Identified</option>
          <option value="resolved">Resolved</option>
        </Select>
      </div>
      {error && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-300"
        >
          Incident list could not be loaded.{" "}
          <button onClick={refetch} className="underline">
            Retry
          </button>
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border border-border-subtle bg-bg-surface">
        <table className="w-full min-w-[850px] text-left text-sm">
          <thead>
            <tr className="border-b border-border-subtle text-[11px] uppercase text-text-disabled">
              <th className="px-4 py-3">Incident</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Severity</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Started</th>
              <th className="px-4 py-3">Duration</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }, (_, i) => (
                  <tr key={i}>
                    <td colSpan="6">
                      <SkeletonRow />
                    </td>
                  </tr>
                ))
              : incidents.map((item) => (
                  <tr key={item._id} className="border-b border-zinc-800/70">
                    <td className="px-4 py-3">
                      <Link
                        to={`/admin/incidents/${item._id}`}
                        className="font-medium text-zinc-200 hover:text-emerald-400"
                      >
                        {item.monitor?.name || "Monitor unavailable"}
                      </Link>
                      <p className="text-xs text-zinc-500">
                        {item.monitor?.url}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-zinc-300">
                      {item.monitor?.owner?.name || "Unknown"}
                      <p className="text-xs text-zinc-500">
                        {item.monitor?.owner?.email}
                      </p>
                    </td>
                    <td className="px-4 py-3 capitalize text-zinc-300">
                      {item.severity}
                    </td>
                    <td className="px-4 py-3 capitalize text-zinc-300">
                      {item.status}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500">
                      {new Date(item.startedAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-400">
                      {item.duration ??
                        `${Math.floor((Date.now() - new Date(item.startedAt).getTime()) / 60000)} min`}
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
        {!loading && !incidents.length && (
          <EmptyState
            icon={AlertTriangle}
            title="No incidents found"
            description="Try changing the filters or search term."
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
