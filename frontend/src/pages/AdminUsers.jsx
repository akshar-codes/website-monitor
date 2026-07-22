import { useState, useMemo } from "react";
import { Search, Users, RefreshCw, MoreHorizontal, ShieldCheck, ShieldOff } from "lucide-react";
import PageContainer from "../components/layout/PageContainer";
import PageHeader from "../components/layout/PageHeader";
import Button from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import Pagination from "../components/ui/Pagination";
import EmptyState from "../components/ui/EmptyState";
import { SkeletonRow } from "../components/ui/Skeleton";
import { useUserList, useUpdateUserRole } from "../hooks/useAdmin";
import { useAuth } from "../hooks/useAuth";
import { formatDate } from "../utils/format";
import { ROLES } from "../constants/roles";
import { cn } from "../utils/cn";

const ROLE_FILTERS = [
  { label: "All", value: "all" },
  { label: "Admins", value: ROLES.ADMIN },
  { label: "Users", value: ROLES.USER },
];

const COLUMN_HEADERS = ["User", "Role", "Joined", ""];

function RoleBadge({ role }) {
  const isAdmin = role === ROLES.ADMIN;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        isAdmin
          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
          : "border-zinc-500/20 bg-zinc-500/10 text-zinc-400",
      )}
    >
      {isAdmin ? <ShieldCheck size={11} /> : <ShieldOff size={11} />}
      {isAdmin ? "Admin" : "User"}
    </span>
  );
}

function UserActionMenu({ targetUser, currentUserId, onRequestRoleChange }) {
  const [open, setOpen] = useState(false);

  // An admin can never change their own role from this menu — mirrors the
  // backend guard in admin.service.js#updateUserRole.
  if (targetUser.id === currentUserId) {
    return <span className="text-[11px] text-text-disabled">You</span>;
  }

  const nextRole = targetUser.role === ROLES.ADMIN ? ROLES.USER : ROLES.ADMIN;

  return (
    <div className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="flex h-7 w-7 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-bg-subtle hover:text-white"
      >
        <MoreHorizontal size={15} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-20 w-48 rounded-xl border border-border-default bg-bg-elevated py-1 shadow-2xl">
            <button
              onClick={() => {
                setOpen(false);
                onRequestRoleChange(targetUser, nextRole);
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-bg-subtle hover:text-white"
            >
              {nextRole === ROLES.ADMIN ? (
                <ShieldCheck size={13} />
              ) : (
                <ShieldOff size={13} />
              )}
              {nextRole === ROLES.ADMIN ? "Make admin" : "Remove admin"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function UserRow({ user, currentUserId, onRequestRoleChange }) {
  return (
    <div className="grid grid-cols-[1fr_100px_140px_44px] items-center gap-3 border-b border-[#1a1a1d] px-5 py-4 transition-colors hover:bg-[#131315] last:border-0">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-white">{user.name}</p>
        <p className="truncate text-xs text-text-muted">{user.email}</p>
      </div>
      <div>
        <RoleBadge role={user.role} />
      </div>
      <div>
        <p className="text-xs text-text-secondary">
          {formatDate(user.createdAt)}
        </p>
      </div>
      <UserActionMenu
        targetUser={user}
        currentUserId={currentUserId}
        onRequestRoleChange={onRequestRoleChange}
      />
    </div>
  );
}

export default function AdminUsers() {
  const { user: currentUser } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [pendingChange, setPendingChange] = useState(null); // { user, nextRole }

  const listParams = useMemo(() => {
    const params = { page, limit: 20 };
    if (roleFilter !== "all") params.role = roleFilter;
    return params;
  }, [page, roleFilter]);

  const { data: usersData, loading, refetch } = useUserList(listParams);
  const users = useMemo(() => usersData?.data || [], [usersData]);
  const pagination = usersData?.pagination;

  const handleRoleChangeSuccess = () => {
    setPendingChange(null);
    refetch();
  };

  const { updateRole, submitting } = useUpdateUserRole(handleRoleChangeSuccess);

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
    );
  }, [users, search]);

  const handleConfirmRoleChange = () => {
    if (!pendingChange) return;
    updateRole(pendingChange.user.id, pendingChange.nextRole, pendingChange.user.name);
  };

  return (
    <PageContainer>
      <PageHeader
        title="Users"
        subtitle="Manage account roles and admin access"
        actions={
          <Button variant="secondary" size="sm" icon={RefreshCw} onClick={refetch}>
            Refresh
          </Button>
        }
        className="mb-6"
      />

      {/* Filters bar */}
      <div className="mb-5 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-60 max-w-sm">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-border-default bg-bg-elevated p-1">
          {ROLE_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => {
                setRoleFilter(f.value);
                setPage(1);
              }}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-all",
                roleFilter === f.value
                  ? "bg-bg-subtle text-white"
                  : "text-text-muted hover:text-text-secondary",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {pagination && (
          <p className="ml-auto text-xs text-text-muted">
            {pagination.total} user{pagination.total !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border-subtle bg-bg-surface">
        <div className="grid grid-cols-[1fr_100px_140px_44px] items-center gap-3 border-b border-border-subtle px-5 py-3">
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
        ) : !filteredUsers.length ? (
          <EmptyState
            icon={Users}
            title={search ? "No users match your search" : "No users found"}
            description={
              search
                ? "Try a different search term."
                : "Users will appear here once they register."
            }
            className="py-16"
          />
        ) : (
          filteredUsers.map((u) => (
            <UserRow
              key={u.id}
              user={u}
              currentUserId={currentUser?.id}
              onRequestRoleChange={(targetUser, nextRole) =>
                setPendingChange({ user: targetUser, nextRole })
              }
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

      <ConfirmDialog
        open={!!pendingChange}
        onClose={() => setPendingChange(null)}
        onConfirm={handleConfirmRoleChange}
        title={
          pendingChange?.nextRole === ROLES.ADMIN
            ? "Grant admin access?"
            : "Remove admin access?"
        }
        description={
          pendingChange?.nextRole === ROLES.ADMIN
            ? `"${pendingChange?.user?.name}" will be able to manage all users and their roles.`
            : `"${pendingChange?.user?.name}" will lose admin access immediately.`
        }
        confirmLabel={
          pendingChange?.nextRole === ROLES.ADMIN ? "Make admin" : "Remove admin"
        }
        confirmVariant={pendingChange?.nextRole === ROLES.ADMIN ? "primary" : "danger"}
        loading={submitting}
      />
    </PageContainer>
  );
}
