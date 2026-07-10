import { useState, useCallback } from "react";
import { useQuery, usePolling } from "./useQuery";
import * as monitorsApi from "../services/api/monitors";
import * as dashboardApi from "../services/api/dashboard";
import { toast } from "sonner";

export function useOverview(pollingInterval = 30000) {
  return usePolling(() => dashboardApi.getOverview(), [], pollingInterval);
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

export function useMonitorMutations(onSuccess) {
  const [submitting, setSubmitting] = useState(false);

  const createMonitor = useCallback(
    async (payload) => {
      setSubmitting(true);
      try {
        await monitorsApi.createMonitor(payload);
        toast.success("Monitor created successfully");
        onSuccess?.("create");
      } catch {
        // Error toast handled by axios interceptor
      } finally {
        setSubmitting(false);
      }
    },
    [onSuccess],
  );

  const updateMonitor = useCallback(
    async (id, payload) => {
      setSubmitting(true);
      try {
        await monitorsApi.updateMonitor(id, payload);
        toast.success("Monitor updated successfully");
        onSuccess?.("update");
      } catch {
        // Error toast handled by axios interceptor
      } finally {
        setSubmitting(false);
      }
    },
    [onSuccess],
  );

  const deleteMonitor = useCallback(
    async (id, name) => {
      setSubmitting(true);
      try {
        await monitorsApi.deleteMonitor(id);
        toast.success(`"${name}" has been deleted`);
        onSuccess?.("delete");
      } catch {
        // Error toast handled by axios interceptor
      } finally {
        setSubmitting(false);
      }
    },
    [onSuccess],
  );

  const toggleMonitor = useCallback(
    async (id, active, name) => {
      setSubmitting(true);
      try {
        await monitorsApi.updateMonitor(id, { active });
        toast.success(`"${name}" has been ${active ? "resumed" : "paused"}`);
        onSuccess?.("toggle");
      } catch {
        // Error toast handled by axios interceptor
      } finally {
        setSubmitting(false);
      }
    },
    [onSuccess],
  );

  return {
    createMonitor,
    updateMonitor,
    deleteMonitor,
    toggleMonitor,
    submitting,
  };
}
