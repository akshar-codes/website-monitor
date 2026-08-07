import { useState, useCallback } from "react";
import { useQuery, usePolling } from "./useQuery";
import * as monitorsApi from "../services/api/monitors";
import * as dashboardApi from "../services/api/dashboard";
import { toast } from "sonner";

export function useOverview(pollingInterval = 30000) {
  return usePolling(() => dashboardApi.getOverview(), [], pollingInterval);
}

export function useDashboardSummary(pollingInterval = 30000) {
  return usePolling(
    () => dashboardApi.getDashboardSummary(),
    [],
    pollingInterval,
  );
}

export function useMonitorList(params = {}) {
  const paramsKey = JSON.stringify(params);
  return useQuery(() => monitorsApi.getMonitors(params), [paramsKey]);
}

export function useMonitorStats(id, window = "24h") {
  return useQuery(
    () => dashboardApi.getMonitorStats(id, { window }),
    [id, window],
    { immediate: !!id },
  );
}

export function useMonitorChartData(id, window = "24h") {
  return useQuery(
    () => dashboardApi.getMonitorChartData(id, { window }),
    [id, window],
    { immediate: !!id },
  );
}

/**
 * Combined Monitor Details page data — one polled request covering config,
 * current status, stats, chart data, recent checks, and any active
 * incident (see backend GET /api/dashboard/monitors/:id/details). Polls on
 * the same cadence as the main dashboard so the status shown stays fresh
 * while the page is open.
 */
export function useMonitorDetails(id, window = "24h", pollingInterval = 30000) {
  return usePolling(
    () => dashboardApi.getMonitorDetails(id, { window }),
    [id, window],
    pollingInterval,
  );
}

/**
 * Monitor analytics / performance insights for an arbitrary window preset
 * or custom date range — backs
 * features/monitorDetails/MonitorAnalytics.jsx. Deliberately NOT polled:
 * unlike the live dashboard/detail views, an analytics query is a
 * point-in-time report the user explicitly requested for a specific
 * range, so it should only re-fetch when that range changes, not on a
 * timer.
 *
 * `params` is either `{ window }` or `{ startDate, endDate }` — see
 * services/api/dashboard.js#getMonitorAnalytics.
 */
export function useMonitorAnalytics(id, params = {}) {
  const paramsKey = JSON.stringify(params);
  return useQuery(
    () => dashboardApi.getMonitorAnalytics(id, params),
    [id, paramsKey],
    { immediate: !!id },
  );
}

export function useRecentHealthChecks(params = {}) {
  const paramsKey = JSON.stringify(params);
  return useQuery(
    () => dashboardApi.getRecentHealthChecks(params),
    [paramsKey],
  );
}

export function useActiveIncidents(params = {}) {
  const paramsKey = JSON.stringify(params);
  return useQuery(() => dashboardApi.getActiveIncidents(params), [paramsKey]);
}

export function useMonitorMutations(onSuccess, onError) {
  const [submitting, setSubmitting] = useState(false);

  const createMonitor = useCallback(
    async (payload) => {
      setSubmitting(true);
      try {
        await monitorsApi.createMonitor(payload);
        toast.success("Monitor created successfully");
        onSuccess?.("create");
      } catch (err) {
        onError?.(err);
      } finally {
        setSubmitting(false);
      }
    },
    [onSuccess, onError],
  );

  const updateMonitor = useCallback(
    async (id, payload) => {
      setSubmitting(true);
      try {
        await monitorsApi.updateMonitor(id, payload);
        toast.success("Monitor updated successfully");
        onSuccess?.("update");
      } catch (err) {
        onError?.(err);
      } finally {
        setSubmitting(false);
      }
    },
    [onSuccess, onError],
  );

  const deleteMonitor = useCallback(
    async (id, name) => {
      setSubmitting(true);
      try {
        await monitorsApi.deleteMonitor(id);
        toast.success(`"${name}" has been deleted`);
        onSuccess?.("delete");
      } catch (err) {
        onError?.(err);
      } finally {
        setSubmitting(false);
      }
    },
    [onSuccess, onError],
  );

  const toggleMonitor = useCallback(
    async (id, active, name) => {
      setSubmitting(true);
      try {
        await monitorsApi.updateMonitor(id, { active });
        toast.success(`"${name}" has been ${active ? "resumed" : "paused"}`);
        onSuccess?.("toggle");
      } catch (err) {
        onError?.(err);
      } finally {
        setSubmitting(false);
      }
    },
    [onSuccess, onError],
  );

  return {
    createMonitor,
    updateMonitor,
    deleteMonitor,
    toggleMonitor,
    submitting,
  };
}
