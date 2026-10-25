import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  RefreshCw,
  Shield,
  Activity,
  AlertTriangle,
} from "lucide-react";
import PageContainer from "../components/layout/PageContainer";
import PageHeader from "../components/layout/PageHeader";
import Button from "../components/ui/Button";
import EmptyState from "../components/ui/EmptyState";
import ChangePlanDialog from "../features/admin/ChangePlanDialog";
import {
  useAdminUser,
  useAdminUserPlan,
  useAdminMonitors,
  useUpdateUserPlan,
} from "../hooks/useAdmin";
import { ROLES } from "../constants/roles";

const panel = "rounded-xl border border-border-subtle bg-bg-surface p-5";
export default function AdminUserDetails() {
  const { id } = useParams();
  const { data, loading, error, refetch } = useAdminUser(id);
  const planQuery = useAdminUserPlan(id);
  const monitorsQuery = useAdminMonitors({ ownerId: id, page: 1, limit: 100 });
  const user = data?.user;
  const monitors = monitorsQuery.data?.data || [];

  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const { updatePlan, submitting: planSubmitting } = useUpdateUserPlan(() => {
    setPlanDialogOpen(false);
    refetch();
    planQuery.refetch();
  });

  const handleConfirmPlanChange = async ({ plan, reason }) => {
    await updatePlan(user.id, plan, reason);
  };
  return (
    <PageContainer>
      <PageHeader
        title={user?.name || "User details"}
        subtitle="Account profile, monitor usage, and recent records"
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
      <Link
        to="/admin/users"
        className="mb-5 inline-flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300"
      >
        <ArrowLeft size={15} />
        Back to users
      </Link>
      {error && (
        <div
          role="alert"
          className="my-4 rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300"
        >
          Could not load this account.{" "}
          <button onClick={refetch} className="underline">
            Retry
          </button>
        </div>
      )}
      {loading && !data ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((n) => (
            <div key={n} className={`${panel} h-40 animate-pulse`} />
          ))}
        </div>
      ) : (
        user && (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <section className={panel}>
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                  <Shield size={16} className="text-emerald-400" />
                  Account
                </h2>
                <p className="text-sm text-zinc-300">{user.email}</p>
                <p className="mt-2 text-sm capitalize text-zinc-400">
                  {user.role === ROLES.ADMIN
                    ? "Admin access"
                    : `${user.role} · ${user.plan}`}{" "}
                  · {user.active ? "Active" : "Suspended"}
                </p>
                <p className="mt-2 text-xs text-zinc-500">
                  Joined {new Date(user.createdAt).toLocaleString()}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Last login{" "}
                  {user.lastLoginAt
                    ? new Date(user.lastLoginAt).toLocaleString()
                    : "Never"}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Email {user.emailVerifiedAt ? "verified" : "unverified"}
                </p>
              </section>
              <section className={panel}>
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                  <Activity size={16} className="text-emerald-400" />
                  Monitor usage
                </h2>
                <p className="text-3xl font-semibold text-white">
                  {data.monitorUsage.total}
                </p>
                <p className="text-sm text-zinc-500">total monitors</p>
                <p className="mt-3 text-sm text-zinc-400">
                  {data.monitorUsage.active} active
                </p>
              </section>
              <section className={panel}>
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                  <AlertTriangle size={16} className="text-emerald-400" />
                  Relevant incidents
                </h2>
                {data.incidents.length ? (
                  data.incidents.map((incident) => (
                    <div
                      key={incident.id}
                      className="border-t border-zinc-800 py-2"
                    >
                      <p className="text-sm text-zinc-300">
                        {incident.monitor?.name || "Monitor unavailable"}
                      </p>
                      <p className="text-xs capitalize text-zinc-500">
                        {incident.severity} · {incident.status} ·{" "}
                        {new Date(incident.startedAt).toLocaleDateString()}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-zinc-500">No incidents found.</p>
                )}
              </section>
            </div>
            <section className={`${panel} mt-4`}>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-white">Monitors</h2>
                  <p className="mt-1 text-xs text-zinc-500">
                    {monitorsQuery.data?.pagination?.total ??
                      data.monitorUsage.total}{" "}
                    total · {data.monitorUsage.active} active
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={monitorsQuery.refetch}
                >
                  Refresh
                </Button>
              </div>
              {monitorsQuery.error ? (
                <p role="alert" className="text-sm text-red-300">
                  Could not load this user’s monitors.{" "}
                  <button onClick={monitorsQuery.refetch} className="underline">
                    Retry
                  </button>
                </p>
              ) : monitorsQuery.loading && !monitorsQuery.data ? (
                <div className="h-20 animate-pulse rounded-lg bg-zinc-900/70" />
              ) : monitors.length ? (
                <div className="divide-y divide-zinc-800">
                  {monitors.map((monitor) => (
                    <Link
                      key={monitor.id}
                      to={`/admin/monitors/${monitor.id}`}
                      className="flex items-center justify-between gap-4 py-3 hover:text-emerald-300"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm text-zinc-200">
                          {monitor.name}
                        </span>
                        <span className="block truncate text-xs text-zinc-500">
                          {monitor.url}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs text-zinc-400">
                        {monitor.latestCheck?.status || "Pending"} ·{" "}
                        {monitor.active ? "Active" : "Paused"}
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-zinc-500">
                  This user has no monitors.
                </p>
              )}
            </section>
            <section className={`${panel} mt-4`}>
              <h2 className="mb-3 text-sm font-semibold text-white">
                Recent account activity
              </h2>
              {data.recentActivity.length ? (
                data.recentActivity.map((item) => (
                  <div key={item.id} className="border-t border-zinc-800 py-3">
                    <p className="text-sm text-zinc-300">{item.description}</p>
                    <p className="mt-1 text-xs capitalize text-zinc-500">
                      {item.category} ·{" "}
                      {new Date(item.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))
              ) : (
                <EmptyState
                  title="No recent activity"
                  description="Activity entries will appear here when the account is used."
                />
              )}
            </section>
            {user.role !== ROLES.ADMIN && planQuery.error && (
              <p role="alert" className="mt-4 text-sm text-red-300">
                Plan details could not be loaded.{" "}
                <button onClick={planQuery.refetch} className="underline">
                  Retry
                </button>
              </p>
            )}
            {user.role !== ROLES.ADMIN && planQuery.data && (
              <section className={`${panel} mt-4`}>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-white">
                    Subscription details
                  </h2>
                  <Button
                    variant="secondary"
                    size="xs"
                    onClick={() => setPlanDialogOpen(true)}
                  >
                    Change plan
                  </Button>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <p className="text-xs text-zinc-500">Current plan</p>
                    <p className="mt-1 capitalize text-white">
                      {planQuery.data.plan.id} · {planQuery.data.plan.status}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Monitor usage</p>
                    <p className="mt-1 text-white">
                      {planQuery.data.usage.monitors.used} /{" "}
                      {planQuery.data.usage.monitors.limit ?? "Unlimited"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">
                      Minimum check interval
                    </p>
                    <p className="mt-1 text-white">
                      {planQuery.data.usage.interval.minSeconds}s
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Expiry</p>
                    <p className="mt-1 text-white">
                      {planQuery.data.plan.expiresAt
                        ? new Date(
                            planQuery.data.plan.expiresAt,
                          ).toLocaleString()
                        : "No scheduled expiry"}
                    </p>
                  </div>
                </div>
                <h3 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Plan change history
                </h3>
                {planQuery.data.history.length ? (
                  planQuery.data.history.map((entry, index) => (
                    <div
                      key={`${entry.changedAt}-${index}`}
                      className="border-t border-zinc-800 py-2 text-sm text-zinc-300"
                    >
                      <span className="capitalize">
                        {entry.from || "New"} → {entry.to}
                      </span>
                      <span className="ml-3 text-xs text-zinc-500">
                        {new Date(entry.changedAt).toLocaleString()}
                      </span>
                      {entry.expiresAt && (
                        <span className="ml-3 text-xs text-zinc-500">
                          expires{" "}
                          {new Date(entry.expiresAt).toLocaleDateString()}
                        </span>
                      )}
                      {entry.reason && (
                        <p className="mt-1 text-xs text-zinc-500">
                          {entry.reason}
                        </p>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-zinc-500">
                    No recorded plan changes.
                  </p>
                )}
              </section>
            )}
          </>
        )
      )}
      {user && (
        <ChangePlanDialog
          open={planDialogOpen}
          onClose={() => setPlanDialogOpen(false)}
          onConfirm={handleConfirmPlanChange}
          targetUser={user}
          loading={planSubmitting}
        />
      )}
    </PageContainer>
  );
}
