import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
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

  return null;
}
