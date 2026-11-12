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

/**
 * Hook to retrieve performance impact analysis comparing before and after deployment.
 */
export function useDeploymentImpact(monitorId, deploymentId, params = {}) {
  const paramsKey = JSON.stringify(params);
  return useQuery(
    () => {
      if (!monitorId || !deploymentId) return null;
      return deploymentsApi.getDeploymentImpact(
        monitorId,
        deploymentId,
        params,
      );
    },
    [monitorId, deploymentId, paramsKey],
    { immediate: Boolean(monitorId && deploymentId) },
  );
}

/**
 * Hook to retrieve regression alert state for a deployment.
 */
export function useDeploymentRegression(monitorId, deploymentId) {
  return useQuery(
    () => {
      if (!monitorId || !deploymentId) return null;
      return deploymentsApi.getDeploymentRegression(monitorId, deploymentId);
    },
    [monitorId, deploymentId],
    { immediate: Boolean(monitorId && deploymentId) },
  );
}
