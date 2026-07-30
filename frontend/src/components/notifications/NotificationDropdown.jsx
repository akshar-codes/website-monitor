import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import NotificationBadge from "./NotificationBadge";
import NotificationItem from "./NotificationItem";
import EmptyState from "../ui/EmptyState";
import {
  useNotificationsCenter,
  useNotificationMutations,
} from "../../hooks/useNotifications";
import { ROUTES } from "../../constants/routes";
import { cn } from "../../utils/cn";

export default function NotificationDropdown() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { unreadTotal, recent, loading } = useNotificationsCenter();
  const { markAsRead, markAllAsRead, submittingId, bulkSubmitting } =
    useNotificationMutations();

  const close = () => setOpen(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        className={cn(
          "relative flex h-9 w-9 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-bg-overlay hover:text-white",
          open && "bg-bg-overlay text-white",
        )}
      >
        <Bell size={17} />
        {unreadTotal > 0 && (
          <NotificationBadge
            count={unreadTotal}
            className="absolute -right-0.5 -top-0.5"
          />
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={close} />
          <div className="absolute right-0 top-11 z-40 w-90 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-border-default bg-bg-elevated shadow-2xl">
            <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
              <p className="text-sm font-semibold text-white">Notifications</p>
              {unreadTotal > 0 && (
                <button
                  onClick={() => markAllAsRead()}
                  disabled={bulkSubmitting}
                  className="flex items-center gap-1 text-[11px] font-medium text-emerald-400 transition-colors hover:text-emerald-300 disabled:opacity-50"
                >
                  {bulkSubmitting ? (
                    <Loader2 size={11} className="animate-spin" />
                  ) : (
                    <CheckCheck size={12} />
                  )}
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto">
              {loading && !recent.length ? (
                <div className="space-y-0">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3">
                      <div className="h-8 w-8 shrink-0 animate-pulse rounded-lg bg-bg-overlay" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3 w-32 animate-pulse rounded bg-bg-overlay" />
                        <div className="h-2.5 w-48 animate-pulse rounded bg-bg-overlay" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : !recent.length ? (
                <EmptyState
                  icon={Bell}
                  title="No notifications yet"
                  description="You'll see updates about your monitors and account here."
                  className="py-10"
                />
              ) : (
                recent.map((n) => (
                  <NotificationItem
                    key={n.id}
                    notification={n}
                    onMarkRead={markAsRead}
                    submitting={submittingId === n.id}
                    compact
                  />
                ))
              )}
            </div>

            <button
              onClick={() => {
                close();
                navigate(ROUTES.NOTIFICATIONS);
              }}
              className="block w-full border-t border-border-subtle px-4 py-2.5 text-center text-xs font-medium text-emerald-400 transition-colors hover:bg-bg-overlay hover:text-emerald-300"
            >
              View all notifications
            </button>
          </div>
        </>
      )}
    </div>
  );
}
