import { RefreshCw } from "lucide-react";
import PageContainer from "../components/layout/PageContainer";
import PageHeader from "../components/layout/PageHeader";
import Button from "../components/ui/Button";
import EmptyState from "../components/ui/EmptyState";
import { useAdminPlanHistory } from "../hooks/useAdmin";

const panel = "rounded-xl border border-border-subtle bg-bg-surface";

export default function AdminPlanHistory() {
  const { data, loading, error, refetch } = useAdminPlanHistory();
  const events = Array.isArray(data) ? data : [];

  return (
    <PageContainer>
      <PageHeader
        title="Plan History"
        subtitle="Upgrade request approvals and subscription expirations."
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
      />
      {error && (
        <p role="alert" className="my-4 text-sm text-red-300">
          Plan history could not be loaded.{" "}
          <button className="underline" onClick={refetch}>
            Retry
          </button>
        </p>
      )}
      {loading && !events.length ? (
        <div className={`${panel} mt-5 h-40 animate-pulse bg-zinc-900/70`} />
      ) : events.length ? (
        <div className={`${panel} mt-5 overflow-x-auto`}>
          <table className="w-full min-w-180 text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-zinc-500">
                <th className="p-4">Event</th>
                <th>User</th>
                <th>Plan change</th>
                <th>Date</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id} className="border-t border-zinc-800">
                  <td className="p-4 capitalize text-zinc-200">
                    {event.type === "approval"
                      ? "Request approved"
                      : "Plan expired"}
                  </td>
                  <td>
                    <span className="text-zinc-200">{event.user.name}</span>
                    <span className="block text-xs text-zinc-500">
                      {event.user.email}
                    </span>
                  </td>
                  <td className="capitalize text-zinc-300">
                    {event.from || "—"} → {event.to || "—"}
                  </td>
                  <td className="whitespace-nowrap text-zinc-400">
                    {new Date(event.date).toLocaleString()}
                  </td>
                  <td className="max-w-100 text-zinc-500">
                    {event.description}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-5">
          <EmptyState
            title="No plan history yet"
            description="Approved upgrade requests and plan expirations will appear here."
          />
        </div>
      )}
      {events.length === 200 && (
        <p className="mt-3 text-xs text-zinc-500">
          Showing the 200 most recent events.
        </p>
      )}
    </PageContainer>
  );
}
