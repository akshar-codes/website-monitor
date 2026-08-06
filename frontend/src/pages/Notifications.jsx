import { useMemo, useState } from "react";
import { Bell, Trash2, CheckCheck } from "lucide-react";
import PageContainer from "../components/layout/PageContainer";
import PageHeader from "../components/layout/PageHeader";
import Button from "../components/ui/Button";
import Pagination from "../components/ui/Pagination";
import EmptyState from "../components/ui/EmptyState";
import NotificationItem from "../components/notifications/NotificationItem";
import NotificationFilters from "../components/notifications/NotificationFilters";
import {
  useNotificationList,
  useNotificationMutations,
  useNotificationsCenter,
} from "../hooks/useNotifications";
import ConfirmDialog from "../components/ui/ConfirmDialog";

export default function Notifications() {
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [clearReadOpen, setClearReadOpen] = useState(false);

  const { unreadByCategory, refetch: refetchCenter } = useNotificationsCenter();

  const listParams = useMemo(() => {
    const params = { page, limit: 20 };
    if (category !== "all") params.category = category;
    if (status !== "all") params.status = status;
    return params;
  }, [page, category, status]);

  const { data, loading, refetch } = useNotificationList(listParams);
  const notifications = data?.data || [];
  const pagination = data?.pagination;

  const handleMutationSuccess = () => {
    setDeleteTarget(null);
    setClearReadOpen(false);
    refetch();
    refetchCenter();
  };

  const {
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearRead,
    submittingId,
    bulkSubmitting,
  } = useNotificationMutations(handleMutationSuccess);

  const hasUnread = Object.values(unreadByCategory).some((c) => c > 0);
  const hasRead = notifications.some((n) => n.read);

  const changeCategory = (v) => {
    setCategory(v);
    setPage(1);
  };

  const changeStatus = (v) => {
    setStatus(v);
    setPage(1);
  };

  return (
    <PageContainer>
      <PageHeader
        title="Notifications"
        subtitle="Updates about your monitors, incidents, and account"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={CheckCheck}
              onClick={() => markAllAsRead(category)}
              disabled={bulkSubmitting || !hasUnread}
            >
              Mark all read
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={Trash2}
              onClick={() => setClearReadOpen(true)}
              disabled={bulkSubmitting || !hasRead}
              className="text-red-400 hover:bg-red-500/10 hover:text-red-300"
            >
              Clear read
            </Button>
          </div>
        }
        className="mb-6"
      />

      <NotificationFilters
        category={category}
        onCategoryChange={changeCategory}
        status={status}
        onStatusChange={changeStatus}
        unreadByCategory={unreadByCategory}
      />

      <div className="rounded-xl border border-border-subtle bg-bg-surface">
        {loading ? (
          <div>
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 border-b border-[#1a1a1d] px-4 py-3 last:border-0"
              >
                <div className="h-8 w-8 shrink-0 animate-pulse rounded-lg bg-bg-overlay" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-40 animate-pulse rounded bg-bg-overlay" />
                  <div className="h-2.5 w-64 animate-pulse rounded bg-bg-overlay" />
                </div>
              </div>
            ))}
          </div>
        ) : !notifications.length ? (
          <EmptyState
            icon={Bell}
            title={
              status !== "all" || category !== "all"
                ? "No notifications match these filters"
                : "You're all caught up"
            }
            description={
              status !== "all" || category !== "all"
                ? "Try a different filter combination."
                : "New updates about your monitors and account will appear here."
            }
            className="py-16"
          />
        ) : (
          notifications.map((n) => (
            <NotificationItem
              key={n.id}
              notification={n}
              onMarkRead={markAsRead}
              onDelete={() => setDeleteTarget(n)}
              submitting={submittingId === n.id}
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
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteNotification(deleteTarget.id)}
        title="Delete Notification"
        description="Are you sure you want to delete this notification?"
        confirmLabel="Delete"
        confirmVariant="danger"
        loading={submittingId === deleteTarget?.id}
      />

      <ConfirmDialog
        open={clearReadOpen}
        onClose={() => setClearReadOpen(false)}
        onConfirm={clearRead}
        title="Clear Read Notifications"
        description="Are you sure you want to clear all read notifications?"
        confirmLabel="Clear"
        confirmVariant="danger"
        loading={bulkSubmitting}
      />
    </PageContainer>
  );
}
