import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw, Search } from "lucide-react";
import PageContainer from "../components/layout/PageContainer";
import PageHeader from "../components/layout/PageHeader";
import Button from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import EmptyState from "../components/ui/EmptyState";
import { useAdminMonitors } from "../hooks/useAdmin";

export default function AdminMonitors() {
  const [search, setSearch] = useState("");
  const params = useMemo(
    () => ({ page: 1, limit: 100, ...(search ? { search } : {}) }),
    [search],
  );
  const { data, loading, error, refetch } = useAdminMonitors(params);
  const monitors = data?.data || [];

  return (
    <PageContainer>
      <PageHeader
        title="Monitor Oversight"
        subtitle="Review monitoring health across user accounts."
      />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
          />
          <Input
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search monitors or URLs"
          />
        </div>
        <Button
          variant="secondary"
          size="sm"
          icon={RefreshCw}
          onClick={refetch}
        >
          Refresh
        </Button>
      </div>
      {error && (
        <p role="alert" className="mb-4 text-sm text-red-300">
          Could not load monitors.{" "}
          <button className="underline" onClick={refetch}>
            Retry
          </button>
        </p>
      )}
      {loading && !data ? (
        <div className="h-40 animate-pulse rounded-xl bg-zinc-900" />
      ) : monitors.length ? (
        <div className="overflow-x-auto rounded-xl border border-border-subtle bg-bg-surface">
          <table className="w-full min-w-170 text-left text-sm">
            <thead>
              <tr className="text-xs uppercase text-zinc-500">
                <th className="p-4">Monitor</th>
                <th>Owner</th>
                <th>Health</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {monitors.map((monitor) => (
                <tr key={monitor.id} className="border-t border-zinc-800">
                  <td className="p-4">
                    <Link
                      className="text-zinc-200 hover:text-emerald-300"
                      to={`/admin/monitors/${monitor.id}`}
                    >
                      {monitor.name}
                    </Link>
                    <p className="mt-1 max-w-80 truncate text-xs text-zinc-500">
                      {monitor.url}
                    </p>
                  </td>
                  <td>
                    <Link
                      className="text-zinc-300 hover:text-emerald-300"
                      to={
                        monitor.owner?.id
                          ? `/admin/users/${monitor.owner.id}`
                          : "/admin/users"
                      }
                    >
                      {monitor.owner?.name || "Unknown"}
                    </Link>
                    <p className="text-xs text-zinc-500">
                      {monitor.owner?.email || ""}
                    </p>
                  </td>
                  <td className="capitalize text-zinc-300">
                    {monitor.latestCheck?.status || "Pending"}
                  </td>
                  <td className="text-zinc-400">
                    {monitor.active ? "Enabled" : "Paused"}
                  </td>
                  <td className="pr-4">
                    <Link
                      className="text-emerald-400"
                      to={`/admin/monitors/${monitor.id}`}
                    >
                      Inspect →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title="No monitors found"
          description="User monitors will appear here for operational review."
        />
      )}
    </PageContainer>
  );
}
