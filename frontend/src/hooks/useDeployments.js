import { useQuery, usePolling } from "./useQuery";
import * as deploymentsApi from "../services/api/deployments";

/**
 * Hook to retrieve and periodically poll deployments for a monitor.
 * Automatically refetches on monitorId, window, or environment filter changes.
 */
export function useMonitorDeployments(
  monitorId,
  params = {},
  pollingInterval = 30000,
) {
  const paramsKey = JSON.stringify(params);
  return usePolling(
    () => {
      if (!monitorId) return null;
      return deploymentsApi.getMonitorDeployments(monitorId, params);
    },
    [monitorId, paramsKey],
    pollingInterval,
  );
}

/**
 * Hook to retrieve an individual deployment event by ID.
 */
export function useMonitorDeploymentDetails(monitorId, deploymentId) {
  return useQuery(
    () => {
      if (!monitorId || !deploymentId) return null;
      return deploymentsApi.getMonitorDeploymentById(monitorId, deploymentId);
    },
    [monitorId, deploymentId],
    { immediate: Boolean(monitorId && deploymentId) },
  );
}
