import { useMemo, useState } from "react";
import {
  useNotificationList,
  useNotificationMutations,
  useNotificationsCenter,
} from "../hooks/useNotifications";
import {
  Page,
  Panel,
  Button,
  Select,
  Empty,
} from "../components/ui/Primitives";
import { Bell, CheckCheck, Trash2, MailOpen } from "lucide-react";

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
    <Page
      title="Notifications"
      description="Stay up to date with incidents, monitor changes, and account events."
      actions={
        <>
          <Button
            variant="secondary"
            disabled={!hasUnread || bulkSubmitting}
            onClick={() =>
              markAllAsRead(category === "all" ? undefined : category)
            }
          >
            <CheckCheck size={14} /> Mark all read
          </Button>
          <Button
            variant="secondary"
            disabled={!hasRead}
            onClick={() => setClearReadOpen(true)}
          >
            <Trash2 size={14} /> Clear read
          </Button>
        </>
      }
    >
      <Panel
        title="Inbox"
        subtitle={`${Object.values(unreadByCategory).reduce((sum, count) => sum + count, 0)} unread notifications`}
      >
        <div className="filter-toolbar">
          <Select
            aria-label="Notification category"
            value={category}
            onChange={(e) => changeCategory(e.target.value)}
          >
            <option value="all">All categories</option>
            {[
              "incident",
              "monitor",
              "ssl",
              "account",
              "billing",
              "security",
            ].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </Select>
          <Select
            aria-label="Read status"
            value={status}
            onChange={(e) => changeStatus(e.target.value)}
          >
            <option value="all">All status</option>
            <option value="unread">Unread</option>
            <option value="read">Read</option>
          </Select>
        </div>
        {loading ? (
          <div className="sw-loading">Loading notifications…</div>
        ) : notifications.length ? (
          <div className="notification-list">
            {notifications.map((item) => (
              <article
                className={`notification-row ${item.read ? "read" : "unread"}`}
                key={item.id || item._id}
              >
                <span className="notification-icon">
                  <Bell size={16} />
                </span>
                <div className="notification-copy">
                  <b>
                    {item.title ||
                      item.subject ||
                      item.category ||
                      "SiteWatch notification"}
                  </b>
                  <p>
                    {item.message ||
                      item.body ||
                      item.description ||
                      "There’s an update to your monitoring account."}
                  </p>
                  <small>
                    {item.createdAt
                      ? new Date(item.createdAt).toLocaleString()
                      : "Recently"}{" "}
                    · {item.category || "General"}
                  </small>
                </div>
                <div className="notification-actions">
                  {!item.read && (
                    <button
                      title="Mark read"
                      disabled={submittingId === item.id}
                      onClick={() => markAsRead(item.id || item._id)}
                    >
                      <MailOpen size={15} />
                    </button>
                  )}
                  <button title="Delete" onClick={() => setDeleteTarget(item)}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <Empty title="You’re all caught up">
            No notifications match your selected filters.
          </Empty>
        )}
        {pagination && (
          <div className="pagination-bar">
            <span>
              Page {pagination.page} of {pagination.totalPages}
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
                disabled={page >= pagination.totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Panel>
      {(deleteTarget || clearReadOpen) && (
        <div className="modal-backdrop">
          <section className="form-modal">
            <h2>
              {deleteTarget
                ? "Delete notification?"
                : "Clear read notifications?"}
            </h2>
            <p className="muted-copy">
              {deleteTarget
                ? "This notification will be removed from your inbox."
                : "All read notifications will be removed."}
            </p>
            <div className="modal-actions">
              <Button
                variant="secondary"
                onClick={() => {
                  setDeleteTarget(null);
                  setClearReadOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                disabled={bulkSubmitting}
                onClick={() =>
                  deleteTarget
                    ? deleteNotification(deleteTarget.id || deleteTarget._id)
                    : clearRead()
                }
              >
                Confirm
              </Button>
            </div>
          </section>
        </div>
      )}
    </Page>
  );
}
