import { useMemo, useState } from "react";
import {
  useNotificationList,
  useNotificationMutations,
  useNotificationsCenter,
} from "../hooks/useNotifications";

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

  return null;
}
