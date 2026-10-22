import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NotificationsContext } from "../contexts/NotificationsContext";
import { useAuth } from "../hooks/useAuth";
import * as notificationsApi from "../services/api/notifications";

const DROPDOWN_LIMIT = 8;
const POLL_INTERVAL_MS = 45000;

/**
 * Fetched once at the app root — mirrors PermissionsContext /
 * PreferencesContext's pattern — so the bell badge, the dropdown preview,
 * and any other consumer share one polled cache instead of each issuing
 * its own request.
 *
 * The full Notifications page manages its own paginated fetch (see
 * hooks/useNotifications.js#useNotificationList) since it needs
 * filtering/pagination this cache intentionally doesn't carry, but every
 * mutation (mark read, mark all read, delete) also updates this context
 * so the badge and dropdown preview stay in sync with page-level actions
 * without waiting for the next poll.
 */
export function NotificationsProvider({ children }) {
  const { user } = useAuth();
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [unreadByCategory, setUnreadByCategory] = useState({});
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(!!user);

  const pollRef = useRef(null);

  const load = useCallback(async () => {
    if (!user) {
      setUnreadTotal(0);
      setUnreadByCategory({});
      setRecent([]);
      setLoading(false);
      return;
    }

    try {
      const [summaryRes, listRes] = await Promise.all([
        notificationsApi.getUnreadSummary(),
        notificationsApi.getNotifications({ page: 1, limit: DROPDOWN_LIMIT }),
      ]);

      setUnreadTotal(summaryRes.data?.total ?? 0);
      setUnreadByCategory(summaryRes.data?.byCategory ?? {});
      setRecent(listRes.data || []);
    } catch {
      // Silent — the bell simply shows stale data until the next poll;
      // the axios interceptor already toasts network-level failures.
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    const initialLoad = setTimeout(load, 0);

    if (!user) return () => clearTimeout(initialLoad);

    pollRef.current = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      clearTimeout(initialLoad);
      clearInterval(pollRef.current);
    };
  }, [user, load]);

  const markReadLocal = useCallback((id) => {
    setRecent((prev) =>
      prev.map((n) => (n.id === id && !n.read ? { ...n, read: true } : n)),
    );
    setUnreadTotal((prev) => Math.max(0, prev - 1));
  }, []);

  const markAllReadLocal = useCallback((category) => {
    setRecent((prev) =>
      prev.map((n) =>
        !category || n.category === category ? { ...n, read: true } : n,
      ),
    );

    if (!category) {
      setUnreadTotal(0);
      setUnreadByCategory({});
      return;
    }

    setUnreadByCategory((prev) => {
      const removed = prev[category] || 0;
      const next = { ...prev };
      delete next[category];
      setUnreadTotal((total) => Math.max(0, total - removed));
      return next;
    });
  }, []);

  const removeLocal = useCallback((id) => {
    setRecent((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const value = useMemo(
    () => ({
      unreadTotal,
      unreadByCategory,
      recent,
      loading,
      refetch: load,
      markReadLocal,
      markAllReadLocal,
      removeLocal,
    }),
    [
      unreadTotal,
      unreadByCategory,
      recent,
      loading,
      load,
      markReadLocal,
      markAllReadLocal,
      removeLocal,
    ],
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}
