import { ShieldCheck, ShieldOff } from "lucide-react";
import PlanBadge from "../../components/ui/PlanBadge";
import UserActionMenu from "./UserActionMenu";
import { formatDate } from "../../utils/format";
import { ROLES } from "../../constants/roles";
import { cn } from "../../utils/cn";

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

function UserStatusBadge({ active }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        active
          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
          : "border-red-500/20 bg-red-500/10 text-red-400",
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          active ? "bg-emerald-400" : "bg-red-400",
        )}
      />
      {active ? "Active" : "Suspended"}
    </span>
  );
}

export default function UserRow({
  user,
  currentUserId,
  onRequestRoleChange,
  onRequestPlanChange,
  onRequestSuspend,
  onRequestReactivate,
  onRequestDelete,
}) {
  return (
    <div className="grid grid-cols-[1fr_90px_100px_100px_120px_44px] items-center gap-3 border-b border-[#1a1a1d] px-5 py-4 transition-colors hover:bg-[#131315] last:border-0">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-white">{user.name}</p>
        <p className="truncate text-xs text-text-muted">{user.email}</p>
      </div>

      <div>
        <RoleBadge role={user.role} />
      </div>

      <div>
        <PlanBadge plan={user.plan} size="sm" />
      </div>

      <div>
        <UserStatusBadge active={user.active} />
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
        onRequestPlanChange={onRequestPlanChange}
        onRequestSuspend={onRequestSuspend}
        onRequestReactivate={onRequestReactivate}
        onRequestDelete={onRequestDelete}
      />
    </div>
  );
}
