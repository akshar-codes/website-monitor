import { useState, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
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
import { formatPlanName } from "../utils/formatPlanName";
import {
  Page,
  Panel,
  Button,
  Input,
  Select,
  Status,
} from "../components/ui/Primitives";
import {
  RefreshCw,
  Shield,
  CreditCard,
  Ban,
  CheckCircle2,
  Trash2,
  ExternalLink,
} from "lucide-react";

const COLUMN_HEADERS = [
  "User",
  "Role",
  "Access / plan",
  "Monitors",
  "Status",
  "Joined",
  "",
];

export default function AdminUsers() {
  const { user: currentUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState(
    searchParams.get("plan") || "all",
  );
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
  const _pagination = usersData?.pagination;

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
    const updated = new URLSearchParams(searchParams);
    if (value === "all") {
      updated.delete("plan");
    } else {
      updated.set("plan", value);
    }
    setSearchParams(updated, { replace: true });
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

  const rows = users.map((user) => ({
    ...user,
    displayStatus: user.active ? "active" : "suspended",
  }));
  const confirmPlan = () => {
    if (!pendingPlanChange) return;
    const plan = window.prompt(
      "Enter plan ID (free, pro, unlimited for Enterprise):",
      pendingPlanChange.plan || "pro",
    );
    if (!plan) return;
    const reason = window.prompt("Reason for this plan change (required):");
    if (reason?.trim())
      handleConfirmPlanChange(plan, { reason: reason.trim() });
  };
  return (
    <Page
      title="User management"
      description="Review accounts, roles, subscriptions, and access state."
      eyebrow="ADMIN"
      actions={
        <Button variant="secondary" onClick={refetch}>
          <RefreshCw size={14} /> Refresh
        </Button>
      }
    >
      <Panel
        title="Customer accounts"
        subtitle={`${usersData?.pagination?.total ?? users.length} users`}
      >
        <div className="admin-user-filters">
          <Input
            aria-label="Search accounts"
            placeholder="Search name or email"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
          <Select
            aria-label="Role"
            value={roleFilter}
            onChange={(e) => handleRoleFilterChange(e.target.value)}
          >
            <option value="all">All roles</option>
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </Select>
          <Select
            aria-label="Status"
            value={statusFilter}
            onChange={(e) => handleStatusFilterChange(e.target.value)}
          >
            <option value="all">All account states</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </Select>
          <Select
            aria-label="Plan"
            value={planFilter}
            onChange={(e) => handlePlanFilterChange(e.target.value)}
          >
            <option value="all">All plans</option>
            <option value="free">Free</option>
            <option value="pro">Pro</option>
            <option value="unlimited">Enterprise</option>
          </Select>
          <Input
            aria-label="Registered after"
            type="date"
            value={registeredFrom}
            onChange={(e) => setRegisteredFrom(e.target.value)}
          />
          <Input
            aria-label="Registered before"
            type="date"
            value={registeredTo}
            onChange={(e) => setRegisteredTo(e.target.value)}
          />
        </div>
        {loading ? (
          <div className="sw-loading">Loading users…</div>
        ) : (
          <div className="sw-table-wrap">
            <table className="sw-table">
              <thead>
                <tr>
                  {COLUMN_HEADERS.map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((user) => {
                  const id = user.id || user._id;
                  return (
                    <tr key={id}>
                      <td>
                        <Link className="user-cell" to={`/admin/users/${id}`}>
                          <span className="avatar">
                            {user.name?.[0] || "?"}
                          </span>
                          <span>
                            <b>{user.name || "Unnamed account"}</b>
                            <small className="table-secondary">
                              {user.email}
                            </small>
                          </span>
                        </Link>
                      </td>
                      <td>
                        <Status value={user.role} />
                      </td>
                      <td>
                        {user.role === ROLES.ADMIN
                          ? "Administrator"
                          : formatPlanName(user.plan)}
                      </td>
                      <td>{user.monitorCount ?? user.monitorsCount ?? 0}</td>
                      <td>
                        <Status value={user.displayStatus} />
                      </td>
                      <td>
                        {user.createdAt
                          ? new Date(user.createdAt).toLocaleDateString()
                          : "—"}
                      </td>
                      <td>
                        <div className="row-actions">
                          <Link
                            aria-label="Details"
                            data-tooltip="Details"
                            to={`/admin/users/${id}`}
                          >
                            <ExternalLink size={14} />
                          </Link>
                          {id !== currentUser?.id && (
                            <>
                              <button
                                aria-label="Change role"
                                data-tooltip="Change role"
                                onClick={() =>
                                  setPendingRoleChange({
                                    user,
                                    nextRole:
                                      user.role === ROLES.ADMIN
                                        ? ROLES.USER
                                        : ROLES.ADMIN,
                                  })
                                }
                              >
                                <Shield size={14} />
                              </button>
                              <button
                                aria-label="Change plan"
                                data-tooltip="Change plan"
                                onClick={() => setPendingPlanChange(user)}
                              >
                                <CreditCard size={14} />
                              </button>
                              {user.active ? (
                                <button
                                  aria-label="Suspend"
                                  data-tooltip="Suspend"
                                  onClick={() => setPendingSuspend(user)}
                                >
                                  <Ban size={14} />
                                </button>
                              ) : (
                                <button
                                  aria-label="Reactivate"
                                  data-tooltip="Reactivate"
                                  onClick={() => setPendingReactivate(user)}
                                >
                                  <CheckCircle2 size={14} />
                                </button>
                              )}
                              <button
                                aria-label="Delete"
                                data-tooltip="Delete"
                                onClick={() => setPendingDelete(user)}
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!rows.length && (
                  <tr>
                    <td colSpan="7" className="table-empty">
                      No accounts match the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {usersData?.pagination && (
          <div className="pagination-bar">
            <span>
              Page {usersData.pagination.page} of{" "}
              {usersData.pagination.totalPages}
            </span>
            <div>
              <Button
                variant="secondary"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                disabled={page >= usersData.pagination.totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Panel>
      {pendingRoleChange && (
        <AdminConfirm
          title={`Change ${pendingRoleChange.user.name}'s role?`}
          description={`This changes access to ${pendingRoleChange.nextRole}.`}
          onCancel={() => setPendingRoleChange(null)}
          onConfirm={handleConfirmRoleChange}
          busy={roleSubmitting}
        />
      )}
      {pendingPlanChange && (
        <AdminConfirm
          title={`Change ${pendingPlanChange.name}'s plan?`}
          description="You will be asked for the target plan and an audit reason."
          onCancel={() => setPendingPlanChange(null)}
          onConfirm={confirmPlan}
          busy={planSubmitting}
        />
      )}
      {pendingSuspend && (
        <AdminConfirm
          title={`Suspend ${pendingSuspend.name}?`}
          description="The user will lose access until reactivated."
          onCancel={() => setPendingSuspend(null)}
          onConfirm={handleConfirmSuspend}
          busy={suspendSubmitting}
          danger
        />
      )}
      {pendingReactivate && (
        <AdminConfirm
          title={`Reactivate ${pendingReactivate.name}?`}
          description="The user can sign in again after reactivation."
          onCancel={() => setPendingReactivate(null)}
          onConfirm={handleConfirmReactivate}
          busy={reactivateSubmitting}
        />
      )}
      {pendingDelete && (
        <AdminConfirm
          title={`Delete ${pendingDelete.name}?`}
          description="This permanently removes the user account."
          onCancel={() => setPendingDelete(null)}
          onConfirm={handleConfirmDelete}
          busy={deleteSubmitting}
          danger
        />
      )}
    </Page>
  );
}

function AdminConfirm({
  title,
  description,
  onCancel,
  onConfirm,
  busy,
  danger,
}) {
  return (
    <div className="modal-backdrop">
      <section className="form-modal">
        <h2>{title}</h2>
        <p className="muted-copy">{description}</p>
        <div className="modal-actions">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? "Working…" : "Continue"}
          </Button>
        </div>
      </section>
    </div>
  );
}
