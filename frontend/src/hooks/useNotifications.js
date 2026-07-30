import { useCallback, useContext, useState } from "react";
import { toast } from "sonner";
import { useQuery } from "./useQuery";
import { NotificationsContext } from "../context/NotificationsContext";
import * as notificationsApi from "../services/api/notifications";

export function useNotificationsCenter() {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error(
      "useNotificationsCenter must be used within a NotificationsProvider",
    );
  }
  return context;
}

/**
 * Full paginated, filterable feed — backs the Notifications page. Kept
 * separate from NotificationsContext's small polled cache since the page
 * needs page/category/status control the shared cache doesn't carry.
 */
export function useNotificationList(params = {}) {
  const paramsKey = JSON.stringify(params);
  return useQuery(() => notificationsApi.getNotifications(params), [paramsKey]);
}

/**
 * Mutation handlers shared by the Notifications page and the dropdown.
 * `onSuccess(action, payload)` fires after every successful mutation so
 * the caller can refetch its own list. The shared NotificationsContext
 * cache is always updated too — optimistically for single-item actions
 * (mark read / delete), or via a background refetch for actions where
 * computing the exact delta isn't worth the complexity (delete, clear-read).
 */
export function useNotificationMutations(onSuccess) {
  const { markReadLocal, markAllReadLocal, removeLocal, refetch } =
    useNotificationsCenter();
  const [submittingId, setSubmittingId] = useState(null);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  const markAsRead = useCallback(
    async (id) => {
      setSubmittingId(id);
      try {
        await notificationsApi.markAsRead(id);
        markReadLocal(id);
        onSuccess?.("markAsRead", { id });
      } catch {
        // Error toast handled by the axios interceptor
      } finally {
        setSubmittingId(null);
      }
    },
    [markReadLocal, onSuccess],
  );

  const markAllAsRead = useCallback(
    async (category) => {
      setBulkSubmitting(true);
      try {
        const { message } = await notificationsApi.markAllAsRead(category);
        markAllReadLocal(category && category !== "all" ? category : undefined);
        toast.success(message || "Notifications marked as read");
        onSuccess?.("markAllAsRead", { category });
      } catch {
        // Error toast handled by the axios interceptor
      } finally {
        setBulkSubmitting(false);
      }
    },
    [markAllReadLocal, onSuccess],
  );

  const deleteNotification = useCallback(
    async (id) => {
      setSubmittingId(id);
      try {
        await notificationsApi.deleteNotification(id);
        removeLocal(id);
        refetch();
        onSuccess?.("delete", { id });
      } catch {
        // Error toast handled by the axios interceptor
      } finally {
        setSubmittingId(null);
      }
    },
    [removeLocal, refetch, onSuccess],
  );

  const clearRead = useCallback(async () => {
    setBulkSubmitting(true);
    try {
      const { message } = await notificationsApi.clearReadNotifications();
      toast.success(message || "Read notifications cleared");
      refetch();
      onSuccess?.("clearRead", {});
    } catch {
      // Error toast handled by the axios interceptor
    } finally {
      setBulkSubmitting(false);
    }
  }, [refetch, onSuccess]);

  return {
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearRead,
    submittingId,
    bulkSubmitting,
  };
}
