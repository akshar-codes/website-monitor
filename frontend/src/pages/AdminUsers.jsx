import { useState, useMemo } from "react";
import { Users, RefreshCw } from "lucide-react";
import PageContainer from "../components/layout/PageContainer";
import PageHeader from "../components/layout/PageHeader";
import Button from "../components/ui/Button";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import Pagination from "../components/ui/Pagination";
import EmptyState from "../components/ui/EmptyState";
import { SkeletonRow } from "../components/ui/Skeleton";
import UserFilters from "../features/admin/UserFilters";
import UserRow from "../features/admin/UserRow";
import ChangePlanDialog from "../features/admin/ChangePlanDialog";
import {
  useUserList,
  useUpdateUserRole,
  useUpdateUserPlan,
  useSuspendUser,
  useReactivateUser,
  useDeleteUser,
} from "../hooks/useAdmin";
import { useAuth } from "../hooks/useAuth";
import { ROLES } from "../constants/roles";

const COLUMN_HEADERS = ["User", "Role", "Plan", "Status", "Joined", ""];

export default function AdminUsers() {
  const { user: currentUser } = useAuth();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");
  const [registeredFrom, setRegisteredFrom] = useState("");
  const [registeredTo, setRegisteredTo] = useState("");

  // Every destructive/state-changing action goes through one of these
  // "pending" slots before it actually fires — each renders its own
  // confirmation UI and only calls the mutation once the admin confirms.
  const [pendingRoleChange, setPendingRoleChange] = useState(null); // { user, nextRole }
  const [pendingPlanChange, setPendingPlanChange] = useState(null); // user
  const [pendingSuspend, setPendingSuspend] = useState(null); // user
  const [pendingReactivate, setPendingReactivate] = useState(null); // user
  const [pendingDelete, setPendingDelete] = useState(null); // user

  const listParams = useMemo(() => {
    const params = { page, limit: 20 };
    if (roleFilter !== "all") params.role = roleFilter;
    if (statusFilter !== "all") params.status = statusFilter;
    if (planFilter !== "all") params.plan = planFilter;
    if (search.trim()) params.search = search.trim();
    if (registeredFrom)
      params.registeredFrom = new Date(
        `${registeredFrom}T00:00:00.000Z`,
      ).toISOString();
    if (registeredTo)
      params.registeredTo = new Date(
        `${registeredTo}T23:59:59.999Z`,
      ).toISOString();
    return params;
  }, [
    page,
    roleFilter,
    statusFilter,
    planFilter,
    search,
    registeredFrom,
    registeredTo,
  ]);

  const { data: usersData, loading, refetch } = useUserList(listParams);
  const users = useMemo(() => usersData?.data || [], [usersData]);
  const pagination = usersData?.pagination;

  const handleMutationSuccess = () => {
    setPendingRoleChange(null);
    setPendingPlanChange(null);
    setPendingSuspend(null);
    setPendingReactivate(null);
    setPendingDelete(null);
    refetch();
  };

  const { updateRole, submitting: roleSubmitting } = useUpdateUserRole(
    handleMutationSuccess,
  );
  const { updatePlan, submitting: planSubmitting } = useUpdateUserPlan(
    handleMutationSuccess,
  );
  const { suspend, submitting: suspendSubmitting } = useSuspendUser(
    handleMutationSuccess,
  );
  const { reactivate, submitting: reactivateSubmitting } = useReactivateUser(
    handleMutationSuccess,
  );
  const { removeUser, submitting: deleteSubmitting } = useDeleteUser(
    handleMutationSuccess,
  );

  const handleSearchChange = (value) => {
    setSearch(value);
    setPage(1);
  };

  const handleRoleFilterChange = (value) => {
    setRoleFilter(value);
    setPage(1);
  };

  const handleStatusFilterChange = (value) => {
    setStatusFilter(value);
    setPage(1);
  };

  const handlePlanFilterChange = (value) => {
    setPlanFilter(value);
    setPage(1);
  };

  const handleConfirmRoleChange = () => {
    if (!pendingRoleChange) return;
    const reason = window.prompt("Reason for this role change (required):");
    if (!reason?.trim()) return;
    updateRole(
      pendingRoleChange.user.id,
      pendingRoleChange.nextRole,
      pendingRoleChange.user.name,
      reason.trim(),
    );
  };

  const handleConfirmPlanChange = (plan, options) => {
    if (!pendingPlanChange) return;
    updatePlan(pendingPlanChange.id, plan, pendingPlanChange.name, options);
  };

  const handleConfirmSuspend = () => {
    if (!pendingSuspend) return;
    const reason = window.prompt(
      "Reason for suspending this account (required):",
    );
    if (!reason?.trim()) return;
    suspend(pendingSuspend.id, pendingSuspend.name, reason.trim());
  };

  const handleConfirmReactivate = () => {
    if (!pendingReactivate) return;
    const reason = window.prompt(
      "Reason for reactivating this account (required):",
    );
    if (!reason?.trim()) return;
    reactivate(pendingReactivate.id, pendingReactivate.name, reason.trim());
  };

  const handleConfirmDelete = () => {
    if (!pendingDelete) return;
    removeUser(pendingDelete.id, pendingDelete.name);
  };

  return (
    <PageContainer>
      <PageHeader
        title="Users"
        subtitle="Manage accounts, roles, subscription plans, and account status"
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
        className="mb-6"
      />

      <UserFilters
        search={search}
        registeredFrom={registeredFrom}
        registeredTo={registeredTo}
        onRegisteredFromChange={(value) => {
          setRegisteredFrom(value);
          setPage(1);
        }}
        onRegisteredToChange={(value) => {
          setRegisteredTo(value);
          setPage(1);
        }}
        onSearchChange={handleSearchChange}
        roleFilter={roleFilter}
        onRoleFilterChange={handleRoleFilterChange}
        planFilter={planFilter}
        onPlanFilterChange={handlePlanFilterChange}
        statusFilter={statusFilter}
        onStatusFilterChange={handleStatusFilterChange}
        totalCount={pagination?.total}
      />

      {/* Table */}
      <div className="rounded-xl border border-border-subtle bg-bg-surface">
        <div className="grid grid-cols-[1fr_90px_100px_100px_120px_44px] items-center gap-3 border-b border-border-subtle px-5 py-3">
          {COLUMN_HEADERS.map((h, i) => (
            <p
              key={i}
              className="text-[11px] font-semibold uppercase tracking-wider text-text-disabled"
            >
              {h}
            </p>
          ))}
        </div>

        {loading ? (
          Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
        ) : !users.length ? (
          <EmptyState
            icon={Users}
            title={search ? "No users match your search" : "No users found"}
            description={
              search
                ? "Try a different search term or clear your filters."
                : "Users will appear here once they register."
            }
            className="py-16"
          />
        ) : (
          users.map((u) => (
            <UserRow
              key={u.id}
              user={u}
              currentUserId={currentUser?.id}
              onRequestRoleChange={(targetUser, nextRole) =>
                setPendingRoleChange({ user: targetUser, nextRole })
              }
              onRequestPlanChange={(targetUser) =>
                setPendingPlanChange(targetUser)
              }
              onRequestSuspend={(targetUser) => setPendingSuspend(targetUser)}
              onRequestReactivate={(targetUser) =>
                setPendingReactivate(targetUser)
              }
              onRequestDelete={(targetUser) => setPendingDelete(targetUser)}
            />
          ))
        )}
      </div>

      {pagination && pagination.totalPages > 1 && (
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          onPageChange={setPage}
          className="mt-4"
        />
      )}

      {/* Role change confirmation */}
      <ConfirmDialog
        open={!!pendingRoleChange}
        onClose={() => setPendingRoleChange(null)}
        onConfirm={handleConfirmRoleChange}
        title={
          pendingRoleChange?.nextRole === ROLES.ADMIN
            ? "Grant admin access?"
            : "Remove admin access?"
        }
        description={
          pendingRoleChange?.nextRole === ROLES.ADMIN
            ? `"${pendingRoleChange?.user?.name}" will be able to manage all users and their roles.`
            : `"${pendingRoleChange?.user?.name}" will lose admin access immediately.`
        }
        confirmLabel={
          pendingRoleChange?.nextRole === ROLES.ADMIN
            ? "Make admin"
            : "Remove admin"
        }
        confirmVariant={
          pendingRoleChange?.nextRole === ROLES.ADMIN ? "primary" : "danger"
        }
        loading={roleSubmitting}
      />

      {/* Plan change */}
      <ChangePlanDialog
        open={!!pendingPlanChange}
        onClose={() => setPendingPlanChange(null)}
        onConfirm={handleConfirmPlanChange}
        targetUser={pendingPlanChange}
        loading={planSubmitting}
      />

      {/* Suspend confirmation */}
      <ConfirmDialog
        open={!!pendingSuspend}
        onClose={() => setPendingSuspend(null)}
        onConfirm={handleConfirmSuspend}
        title="Suspend this account?"
        description={`"${pendingSuspend?.name}" will be immediately signed out of every device and won't be able to log back in until reactivated.`}
        confirmLabel="Suspend account"
        confirmVariant="danger"
        loading={suspendSubmitting}
      />

      {/* Reactivate confirmation */}
      <ConfirmDialog
        open={!!pendingReactivate}
        onClose={() => setPendingReactivate(null)}
        onConfirm={handleConfirmReactivate}
        title="Reactivate this account?"
        description={`"${pendingReactivate?.name}" will be able to log in again.`}
        confirmLabel="Reactivate account"
        confirmVariant="primary"
        loading={reactivateSubmitting}
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Delete this user permanently?"
        description={`"${pendingDelete?.name}" and all of their monitors, incidents, and health-check history will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete user"
        confirmVariant="danger"
        loading={deleteSubmitting}
      />
    </PageContainer>
  );
}
