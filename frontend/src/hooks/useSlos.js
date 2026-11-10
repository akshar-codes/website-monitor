import { useState, useCallback } from "react";
import { useQuery, usePolling } from "./useQuery";
import * as slosApi from "../services/api/slos";
import { toast } from "sonner";

export function useSloList(params = {}, pollingInterval = 30000) {
  const paramsKey = JSON.stringify(params);
  return usePolling(
    () => slosApi.getSlos(params),
    [paramsKey],
    pollingInterval,
  );
}

export function useSloDetails(id, pollingInterval = 30000) {
  return usePolling(
    async () => {
      if (!id) return null;
      const [sloRes, snapshotRes, alertStateRes] = await Promise.allSettled([
        slosApi.getSloById(id),
        slosApi.getLatestSloSnapshot(id),
        slosApi.getSloAlertState(id),
      ]);

      if (sloRes.status === "rejected") {
        throw sloRes.reason;
      }

      return {
        slo: sloRes.value || null,
        snapshot: snapshotRes.status === "fulfilled" ? snapshotRes.value : null,
        alertState:
          alertStateRes.status === "fulfilled" ? alertStateRes.value : null,
      };
    },
    [id],
    pollingInterval,
  );
}

export function useSloSnapshots(id, params = {}) {
  const paramsKey = JSON.stringify(params);
  return useQuery(() => slosApi.getSloSnapshots(id, params), [id, paramsKey], {
    immediate: !!id,
  });
}

export function useSloAlertState(id) {
  return useQuery(() => slosApi.getSloAlertState(id), [id], {
    immediate: !!id,
  });
}

export function useMonitorSlos(monitorId, params = {}) {
  const paramsKey = JSON.stringify(params);
  return useQuery(
    () => slosApi.getMonitorSlos(monitorId, params),
    [monitorId, paramsKey],
    { immediate: !!monitorId },
  );
}

export function useSloMutations(onSuccess, onError) {
  const [submitting, setSubmitting] = useState(false);

  const createSlo = useCallback(
    async (payload) => {
      setSubmitting(true);
      try {
        const created = await slosApi.createSlo(payload);
        toast.success("SLO created successfully");
        onSuccess?.("create", created);
        return created;
      } catch (err) {
        toast.error(err.response?.data?.message || "Could not create SLO");
        onError?.(err);
        throw err;
      } finally {
        setSubmitting(false);
      }
    },
    [onSuccess, onError],
  );

  const updateSlo = useCallback(
    async (id, payload) => {
      setSubmitting(true);
      try {
        const updated = await slosApi.updateSlo(id, payload);
        toast.success("SLO updated successfully");
        onSuccess?.("update", updated);
        return updated;
      } catch (err) {
        toast.error(err.response?.data?.message || "Could not update SLO");
        onError?.(err);
        throw err;
      } finally {
        setSubmitting(false);
      }
    },
    [onSuccess, onError],
  );

  const deleteSlo = useCallback(
    async (id, name) => {
      setSubmitting(true);
      try {
        await slosApi.deleteSlo(id);
        toast.success(`SLO "${name || id}" has been deleted`);
        onSuccess?.("delete", id);
      } catch (err) {
        toast.error(err.response?.data?.message || "Could not delete SLO");
        onError?.(err);
        throw err;
      } finally {
        setSubmitting(false);
      }
    },
    [onSuccess, onError],
  );

  const toggleSlo = useCallback(
    async (id, enabled, name) => {
      setSubmitting(true);
      try {
        await slosApi.updateSlo(id, { enabled });
        toast.success(
          `SLO "${name || id}" ${enabled ? "enabled" : "disabled"}`,
        );
        onSuccess?.("toggle", { id, enabled });
      } catch (err) {
        toast.error(
          err.response?.data?.message ||
            `Could not ${enabled ? "enable" : "disable"} SLO`,
        );
        onError?.(err);
        throw err;
      } finally {
        setSubmitting(false);
      }
    },
    [onSuccess, onError],
  );

  const evaluateSlo = useCallback(
    async (id) => {
      setSubmitting(true);
      try {
        const result = await slosApi.triggerSloEvaluation(id);
        const sli =
          result?.sliPercentage != null
            ? `${result.sliPercentage.toFixed(2)}%`
            : "updated";
        toast.success(`SLO evaluated: current SLI is ${sli}`);
        onSuccess?.("evaluate", result);
        return result;
      } catch (err) {
        toast.error(
          err.response?.data?.message || "Failed to trigger evaluation",
        );
        onError?.(err);
        throw err;
      } finally {
        setSubmitting(false);
      }
    },
    [onSuccess, onError],
  );

  return {
    createSlo,
    updateSlo,
    deleteSlo,
    toggleSlo,
    evaluateSlo,
    submitting,
  };
}
