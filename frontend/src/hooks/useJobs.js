import { useState, useCallback } from "react";
import { usePolling } from "./useQuery.js";
import * as jobsApi from "../services/api/jobs.js";
import { toast } from "sonner";

/**
 * Hook to fetch paginated and filtered job monitors with automatic polling.
 */
export function useJobList(params = {}, pollingInterval = 15000) {
  const paramsKey = JSON.stringify(params);
  return usePolling(
    () => jobsApi.getJobMonitors(params),
    [paramsKey],
    pollingInterval,
  );
}

/**
 * Hook to fetch a single job monitor's details with automatic polling.
 */
export function useJobDetails(id, pollingInterval = 10000) {
  return usePolling(
    async () => {
      if (!id) return null;
      return jobsApi.getJobMonitorById(id);
    },
    [id],
    pollingInterval,
  );
}

/**
 * Hook to fetch execution runs for a job monitor with pagination and filtering.
 */
export function useJobRuns(id, params = {}, pollingInterval = 10000) {
  const paramsKey = JSON.stringify(params);
  return usePolling(
    async () => {
      if (!id) return null;
      return jobsApi.getJobRuns(id, params);
    },
    [id, paramsKey],
    pollingInterval,
  );
}

/**
 * Hook for performing mutations on job monitors (create, update, delete, pause, rotate token).
 */
export function useJobMutations(onSuccess, onError) {
  const [submitting, setSubmitting] = useState(false);

  const createJob = useCallback(
    async (payload) => {
      setSubmitting(true);
      try {
        const created = await jobsApi.createJobMonitor(payload);
        toast.success("Background job created successfully");
        onSuccess?.("create", created);
        return created;
      } catch (err) {
        const msg =
          err.response?.data?.message ||
          err.message ||
          "Failed to create background job";
        toast.error(msg);
        onError?.(err);
        throw err;
      } finally {
        setSubmitting(false);
      }
    },
    [onSuccess, onError],
  );

  const updateJob = useCallback(
    async (id, payload) => {
      setSubmitting(true);
      try {
        const updated = await jobsApi.updateJobMonitor(id, payload);
        toast.success("Background job updated successfully");
        onSuccess?.("update", updated);
        return updated;
      } catch (err) {
        const msg =
          err.response?.data?.message ||
          err.message ||
          "Failed to update background job";
        toast.error(msg);
        onError?.(err);
        throw err;
      } finally {
        setSubmitting(false);
      }
    },
    [onSuccess, onError],
  );

  const deleteJob = useCallback(
    async (id) => {
      setSubmitting(true);
      try {
        await jobsApi.deleteJobMonitor(id);
        toast.success("Background job deleted successfully");
        onSuccess?.("delete", id);
      } catch (err) {
        const msg =
          err.response?.data?.message ||
          err.message ||
          "Failed to delete background job";
        toast.error(msg);
        onError?.(err);
        throw err;
      } finally {
        setSubmitting(false);
      }
    },
    [onSuccess, onError],
  );

  const togglePause = useCallback(
    async (id) => {
      try {
        const result = await jobsApi.toggleJobMonitorPause(id);
        const action = result.active ? "resumed" : "paused";
        toast.success(`Background job ${action}`);
        onSuccess?.("pause", result);
        return result;
      } catch (err) {
        const msg =
          err.response?.data?.message ||
          err.message ||
          "Failed to toggle job pause status";
        toast.error(msg);
        onError?.(err);
        throw err;
      }
    },
    [onSuccess, onError],
  );

  const rotateToken = useCallback(
    async (id) => {
      setSubmitting(true);
      try {
        const result = await jobsApi.rotateJobMonitorToken(id);
        toast.success(
          "Token rotated successfully. Previous token valid for 24h.",
        );
        onSuccess?.("rotate-token", result);
        return result;
      } catch (err) {
        const msg =
          err.response?.data?.message ||
          err.message ||
          "Failed to rotate reporting token";
        toast.error(msg);
        onError?.(err);
        throw err;
      } finally {
        setSubmitting(false);
      }
    },
    [onSuccess, onError],
  );

  return {
    createJob,
    updateJob,
    deleteJob,
    togglePause,
    rotateToken,
    submitting,
  };
}
