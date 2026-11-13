import { useState, useCallback } from "react";
import { useQuery, usePolling } from "./useQuery";
import * as dependenciesApi from "../services/api/dependencies";
import { toast } from "sonner";

/**
 * Hook to retrieve the complete dependency graph with periodic polling.
 */
export function useDependencyGraph(params = {}, pollingInterval = 30000) {
  const paramsKey = JSON.stringify(params);
  return usePolling(
    () => dependenciesApi.getDependencyGraph(params),
    [paramsKey],
    pollingInterval,
  );
}

/**
 * Hook to retrieve direct dependencies and dependents for a specific monitor.
 */
export function useMonitorDependencies(monitorId) {
  return useQuery(
    () => dependenciesApi.getMonitorDependencies(monitorId),
    [monitorId],
    { immediate: Boolean(monitorId) },
  );
}

/**
 * Hook to load external services (databases, third-party APIs, etc.).
 */
export function useExternalServices() {
  return useQuery(() => dependenciesApi.getExternalServices(), []);
}

/**
 * Mutation hook for creating, updating, and deleting service dependencies.
 */
export function useDependencyMutations(onSuccess) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const createDependency = useCallback(
    async (payload) => {
      setSubmitting(true);
      setError(null);
      try {
        const result = await dependenciesApi.createDependency(payload);
        toast.success("Service dependency added successfully");
        onSuccess?.(result);
        return result;
      } catch (err) {
        const message =
          err.response?.data?.message ||
          err.message ||
          "Failed to create dependency";
        setError(message);
        toast.error(message);
        throw err;
      } finally {
        setSubmitting(false);
      }
    },
    [onSuccess],
  );

  const updateDependency = useCallback(
    async (id, payload) => {
      setSubmitting(true);
      setError(null);
      try {
        const result = await dependenciesApi.updateDependency(id, payload);
        toast.success("Service dependency updated");
        onSuccess?.(result);
        return result;
      } catch (err) {
        const message =
          err.response?.data?.message ||
          err.message ||
          "Failed to update dependency";
        setError(message);
        toast.error(message);
        throw err;
      } finally {
        setSubmitting(false);
      }
    },
    [onSuccess],
  );

  const deleteDependency = useCallback(
    async (id) => {
      setSubmitting(true);
      setError(null);
      try {
        const result = await dependenciesApi.deleteDependency(id);
        toast.success("Service dependency removed");
        onSuccess?.(result);
        return result;
      } catch (err) {
        const message =
          err.response?.data?.message ||
          err.message ||
          "Failed to delete dependency";
        setError(message);
        toast.error(message);
        throw err;
      } finally {
        setSubmitting(false);
      }
    },
    [onSuccess],
  );

  const validateDependency = useCallback(async (payload) => {
    try {
      const result = await dependenciesApi.validateProposedDependency(payload);
      return result?.data || result;
    } catch (err) {
      return {
        isValid: false,
        message: err.response?.data?.message || err.message,
      };
    }
  }, []);

  return {
    createDependency,
    updateDependency,
    deleteDependency,
    validateDependency,
    submitting,
    error,
  };
}
