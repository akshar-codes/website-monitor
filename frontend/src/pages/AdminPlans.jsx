import { useMemo, useState } from "react";
import { CreditCard, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import PageContainer from "../components/layout/PageContainer";
import PageHeader from "../components/layout/PageHeader";
import Button from "../components/ui/Button";
import EmptyState from "../components/ui/EmptyState";
import Pagination from "../components/ui/Pagination";
import { SkeletonRow } from "../components/ui/Skeleton";
import ChangePlanDialog from "../features/admin/ChangePlanDialog";
import {
  useAdminPlanOverview,
  useUserList,
  useUpdateUserPlan,
} from "../hooks/useAdmin";

const panel = "rounded-xl border border-border-subtle bg-bg-surface p-5";
export default function AdminPlans() {
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const {
    data: plans,
    loading: plansLoading,
    error: plansError,
    refetch: refetchPlans,
  } = useAdminPlanOverview();
  const {
    data: usersData,
    loading: usersLoading,
    error: usersError,
    refetch: refetchUsers,
  } = useUserList({ page, limit: 20 });
  const refresh = () => {
    refetchPlans();
    refetchUsers();
  };
  const { updatePlan, submitting } = useUpdateUserPlan(() => {
    setSelected(null);
    refresh();
  });
  const users = useMemo(() => usersData?.data || [], [usersData]);
  return (
    <PageContainer>
      <PageHeader
        title="Plan management"
        subtitle="Plan definitions, subscriber totals, and user assignments"
        actions={
          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            onClick={refresh}
          >
            Refresh
          </Button>
        }
        className="mb-6"
      />
      {(plansError || usersError) && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-300"
        >
          Plan management data failed to load.{" "}
          <button onClick={refresh} className="underline">
            Retry
          </button>
        </div>
      )}
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        {plansLoading && !plans
          ? [0, 1, 2].map((i) => (
              <div key={i} className={`${panel} h-44 animate-pulse`} />
            ))
          : (plans || []).map((plan) => (
              <section key={plan.id} className={panel}>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-white">
                    {plan.name}
                  </h2>
                  <CreditCard size={17} className="text-emerald-400" />
                </div>
                <p className="mt-1 text-sm text-zinc-500">{plan.tagline}</p>
                <p className="mt-4 text-2xl font-semibold text-white">
                  {plan.users}
                  <span className="ml-2 text-xs font-normal text-zinc-500">
                    accounts
                  </span>
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  {plan.activeUsers} active ·{" "}
                  {plan.limits.maxMonitors ?? "Unlimited"} monitors ·{" "}
                  {plan.limits.dataRetentionDays} day retention
                </p>
                <ul className="mt-3 space-y-1 text-xs text-zinc-400">
                  {plan.features.slice(0, 3).map((feature) => (
                    <li key={feature}>• {feature}</li>
                  ))}
                </ul>
              </section>
            ))}
      </div>
      <section className={panel}>
        <h2 className="mb-4 text-sm font-semibold text-white">
          User plan assignments
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-162.5 text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-xs uppercase text-zinc-500">
                <th className="pb-3">User</th>
                <th className="pb-3">Role</th>
                <th className="pb-3">Plan</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {usersLoading
                ? Array.from({ length: 5 }, (_, i) => (
                    <tr key={i}>
                      <td colSpan="5">
                        <SkeletonRow />
                      </td>
                    </tr>
                  ))
                : users.map((user) => (
                    <tr key={user.id} className="border-b border-zinc-800/70">
                      <td className="py-3">
                        <Link
                          to={`/admin/users/${user.id}`}
                          className="font-medium text-zinc-200 hover:text-emerald-400"
                        >
                          {user.name}
                        </Link>
                        <p className="text-xs text-zinc-500">{user.email}</p>
                      </td>
                      <td className="capitalize text-zinc-400">{user.role}</td>
                      <td className="capitalize text-zinc-300">{user.plan}</td>
                      <td className="text-zinc-400">
                        {user.active ? "Active" : "Suspended"}
                      </td>
                      <td>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setSelected(user)}
                        >
                          Change plan
                        </Button>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
        {!usersLoading && !users.length && (
          <EmptyState
            title="No users found"
            description="User accounts will appear here."
          />
        )}
        {usersData?.pagination?.totalPages > 1 && (
          <Pagination
            page={page}
            totalPages={usersData.pagination.totalPages}
            onPageChange={setPage}
            className="mt-4"
          />
        )}
      </section>
      <ChangePlanDialog
        open={!!selected}
        onClose={() => setSelected(null)}
        targetUser={selected}
        loading={submitting}
        onConfirm={(plan, options) =>
          selected && updatePlan(selected.id, plan, selected.name, options)
        }
      />
    </PageContainer>
  );
}
