import { useState, useCallback } from "react";
import { useQuery } from "./useQuery";
import * as adminApi from "../services/api/admin";
import { toast } from "sonner";

const adminDashboardCache = new Map();
export function useAdminDashboard(params = {}) {
  const paramsKey = JSON.stringify(params);
  const query = useQuery(() => adminApi.getAdminDashboard(params), [paramsKey]);
  if (query.data) adminDashboardCache.set(paramsKey, query.data);
  return {
    ...query,
    data: query.data || adminDashboardCache.get(paramsKey) || null,
  };
}

export function useAdminMonitors(params = {}) {
  const paramsKey = JSON.stringify(params);
  return useQuery(() => adminApi.getAdminMonitors(params), [paramsKey]);
}
export function useAdminMonitor(id, window = "30d") {
  return useQuery(() => adminApi.getAdminMonitor(id, { window }), [id, window]);
}
export function useAdminMonitorCheck(onSuccess) {
  const [submitting, setSubmitting] = useState(false);
  const check = useCallback(
    async (id) => {
      setSubmitting(true);
      try {
        const data = await adminApi.checkAdminMonitor(id);
        toast.success("Manual check completed");
        onSuccess?.(data);
      } catch {
        /* shared API interceptor reports request errors */
      } finally {
        setSubmitting(false);
      }
    },
    [onSuccess],
  );
  return { check, submitting };
}
export function useAdminIncidents(params = {}) {
  const paramsKey = JSON.stringify(params);
  return useQuery(() => adminApi.getAdminIncidents(params), [paramsKey]);
}
export function useAdminAuditEvents(params = {}) {
  const paramsKey = JSON.stringify(params);
  return useQuery(() => adminApi.getAdminAuditEvents(params), [paramsKey]);
}
export function useAdminAuditEvent(id) {
  return useQuery(() => adminApi.getAdminAuditEvent(id), [id]);
}
export function useAdminIncident(id) {
  return useQuery(() => adminApi.getAdminIncident(id), [id]);
}
export function useResolveAdminIncident(onSuccess) {
  const [submitting, setSubmitting] = useState(false);
  const resolve = useCallback(
    async (id, payload) => {
      setSubmitting(true);
      try {
        const data = await adminApi.resolveAdminIncident(id, payload);
        toast.success("Incident resolved");
        onSuccess?.(data);
      } catch {
        /* shared API interceptor reports request errors */
      } finally {
        setSubmitting(false);
      }
    },
    [onSuccess],
  );
  return { resolve, submitting };
}

export function useUserList(params = {}) {
  const paramsKey = JSON.stringify(params);
  return useQuery(() => adminApi.getUsers(params), [paramsKey]);
}

export function useAdminUser(userId) {
  return useQuery(() => adminApi.getAdminUser(userId), [userId]);
}

export function useAdminUserPlan(userId) {
  return useQuery(() => adminApi.getAdminUserPlan(userId), [userId]);
}

export function useAdminPlanOverview() {
  return useQuery(() => adminApi.getAdminPlanOverview(), []);
}

export function useAdminPlanHistory() {
  return useQuery(() => adminApi.getAdminPlanHistory(), []);
}

export function useUpdateUserRole(onSuccess) {
  const [submitting, setSubmitting] = useState(false);

  const updateRole = useCallback(
    async (userId, role, name, reason) => {
      setSubmitting(true);
      try {
        await adminApi.updateUserRole(userId, role, reason);
        toast.success(
          `${name ? `"${name}"'s` : "User"} role updated to ${role}`,
        );
        onSuccess?.();
      } catch {
        // Error toast handled by the axios interceptor
      } finally {
        setSubmitting(false);
      }
    },
    [onSuccess],
  );

  return { updateRole, submitting };
}

export function useUpdateUserPlan(onSuccess) {
  const [submitting, setSubmitting] = useState(false);

  const updatePlan = useCallback(
    async (userId, plan, name, options = {}) => {
      setSubmitting(true);
      try {
        const { message } = await adminApi.updateUserPlan(
          userId,
          plan,
          options,
        );
        toast.success(
          message || `${name ? `"${name}"'s` : "User's"} plan updated`,
        );
        onSuccess?.();
      } catch {
        // Error toast handled by the axios interceptor
      } finally {
        setSubmitting(false);
      }
    },
    [onSuccess],
  );

  return { updatePlan, submitting };
}

export function useSuspendUser(onSuccess) {
  const [submitting, setSubmitting] = useState(false);

  const suspend = useCallback(
    async (userId, name, reason) => {
      setSubmitting(true);
      try {
        await adminApi.suspendUser(userId, reason);
        toast.success(`${name ? `"${name}"` : "User"} has been suspended`);
        onSuccess?.();
      } catch {
        // Error toast handled by the axios interceptor
      } finally {
        setSubmitting(false);
      }
    },
    [onSuccess],
  );

  return { suspend, submitting };
}

export function useReactivateUser(onSuccess) {
  const [submitting, setSubmitting] = useState(false);

  const reactivate = useCallback(
    async (userId, name, reason) => {
      setSubmitting(true);
      try {
        await adminApi.reactivateUser(userId, reason);
        toast.success(`${name ? `"${name}"` : "User"} has been reactivated`);
        onSuccess?.();
      } catch {
        // Error toast handled by the axios interceptor
      } finally {
        setSubmitting(false);
      }
    },
    [onSuccess],
  );

  return { reactivate, submitting };
}

export function useDeleteUser(onSuccess) {
  const [submitting, setSubmitting] = useState(false);

  const removeUser = useCallback(
    async (userId, name) => {
      setSubmitting(true);
      try {
        await adminApi.deleteUser(userId);
        toast.success(`${name ? `"${name}"` : "User"} has been deleted`);
        onSuccess?.();
      } catch {
        // Error toast handled by the axios interceptor
      } finally {
        setSubmitting(false);
      }
    },
    [onSuccess],
  );

  return { removeUser, submitting };
}

// ── Plan upgrade requests ────────────────────────────────────────────────────

export function usePlanUpgradeRequestList(params = {}) {
  const paramsKey = JSON.stringify(params);
  return useQuery(() => adminApi.getPlanUpgradeRequests(params), [paramsKey]);
}

export function useApprovePlanUpgradeRequest(onSuccess) {
  const [submittingId, setSubmittingId] = useState(null);

  const approve = useCallback(
    async (
      requestId,
      {
        grantedPlan,
        reason,
        expiresAt,
        paymentRequired,
        period,
        discountPercent,
        planExpiresAt,
      },
    ) => {
      setSubmittingId(requestId);
      try {
        const { message } = await adminApi.approvePlanUpgradeRequest(
          requestId,
          {
            grantedPlan,
            reason,
            expiresAt,
            paymentRequired,
            period,
            discountPercent,
            planExpiresAt,
          },
        );
        window.dispatchEvent(new Event("admin:plan-requests-changed"));
        toast.success(message || "Upgrade request approved");
        onSuccess?.();
      } catch {
        // Error toast handled by the axios interceptor
      } finally {
        setSubmittingId(null);
      }
    },
    [onSuccess],
  );

  return { approve, submittingId };
}

export function useRejectPlanUpgradeRequest(onSuccess) {
  const [submittingId, setSubmittingId] = useState(null);

  const reject = useCallback(
    async (requestId, reason) => {
      setSubmittingId(requestId);
      try {
        const { message } = await adminApi.rejectPlanUpgradeRequest(
          requestId,
          reason,
        );
        window.dispatchEvent(new Event("admin:plan-requests-changed"));
        toast.success(message || "Upgrade request rejected");
        onSuccess?.();
      } catch {
        // Error toast handled by the axios interceptor
      } finally {
        setSubmittingId(null);
      }
    },
    [onSuccess],
  );

  return { reject, submittingId };
}
