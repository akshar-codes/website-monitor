import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useQuery, usePolling } from "./useQuery";
import * as sslApi from "../services/api/ssl";

/**
 * SSL overview — polled at a slow cadence since certificate/domain data
 * only changes on a ~daily recheck schedule server-side (see
 * backend/src/workers/sslScheduler.js), unlike the 30s live-status polls
 * used elsewhere in the app.
 */
export function useSslOverview(pollingInterval = 5 * 60 * 1000) {
  return usePolling(() => sslApi.getSslOverview(), [], pollingInterval);
}

export function useMonitorSsl(monitorId) {
  return useQuery(() => sslApi.getMonitorSsl(monitorId), [monitorId], {
    immediate: !!monitorId,
  });
}

export function useSslMutations(onSuccess) {
  const [checking, setChecking] = useState(false);
  const [updatingSettings, setUpdatingSettings] = useState(false);

  const triggerCheck = useCallback(
    async (monitorId) => {
      setChecking(true);
      try {
        const { data } = await sslApi.triggerSslCheck(monitorId);
        toast.success("SSL certificate checked");
        onSuccess?.(data);
        return data;
      } catch {
        // Error toast handled by the axios interceptor
        return null;
      } finally {
        setChecking(false);
      }
    },
    [onSuccess],
  );

  const updateSettings = useCallback(
    async (monitorId, enabled) => {
      setUpdatingSettings(true);
      try {
        const { data, message } = await sslApi.updateSslSettings(
          monitorId,
          enabled,
        );
        toast.success(message || "SSL monitoring settings updated");
        onSuccess?.(data);
        return data;
      } catch {
        return null;
      } finally {
        setUpdatingSettings(false);
      }
    },
    [onSuccess],
  );

  return { triggerCheck, checking, updateSettings, updatingSettings };
}
