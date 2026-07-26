import { useState } from "react";
import {
  MoreHorizontal,
  ShieldCheck,
  ShieldOff,
  CreditCard,
  Ban,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { ROLES } from "../../constants/roles";

/**
 * `targetUser` is a plain user object (id, name, email, role, plan,
 * active, createdAt) as returned by GET /api/admin/users.
 */
export default function UserActionMenu({
  targetUser,
  currentUserId,
  onRequestRoleChange,
  onRequestPlanChange,
  onRequestSuspend,
  onRequestReactivate,
  onRequestDelete,
}) {
  const [open, setOpen] = useState(false);

  // An admin can never act on their own account from this menu — mirrors
  // the backend guards in services/admin.service.js.
  if (targetUser.id === currentUserId) {
    return <span className="text-[11px] text-text-disabled">You</span>;
  }

  const nextRole = targetUser.role === ROLES.ADMIN ? ROLES.USER : ROLES.ADMIN;
  const isSuspended = !targetUser.active;

  const close = () => setOpen(false);

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
          <div className="fixed inset-0 z-10" onClick={close} />
          <div className="absolute right-0 top-8 z-20 w-52 rounded-xl border border-border-default bg-bg-elevated py-1 shadow-2xl">
            <button
              onClick={() => {
                close();
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

            <button
              onClick={() => {
                close();
                onRequestPlanChange(targetUser);
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-bg-subtle hover:text-white"
            >
              <CreditCard size={13} />
              Change plan
            </button>

            <div className="my-1 h-px bg-bg-subtle" />

            {isSuspended ? (
              <button
                onClick={() => {
                  close();
                  onRequestReactivate(targetUser);
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-emerald-400 transition-colors hover:bg-emerald-500/10"
              >
                <RotateCcw size={13} />
                Reactivate account
              </button>
            ) : (
              <button
                onClick={() => {
                  close();
                  onRequestSuspend(targetUser);
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-amber-400 transition-colors hover:bg-amber-500/10"
              >
                <Ban size={13} />
                Suspend account
              </button>
            )}

            <div className="my-1 h-px bg-bg-subtle" />

            <button
              onClick={() => {
                close();
                onRequestDelete(targetUser);
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-red-400 transition-colors hover:bg-red-500/10"
            >
              <Trash2 size={13} />
              Delete user
            </button>
          </div>
        </>
      )}
    </div>
  );
}
