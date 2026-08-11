import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useQuery } from "./useQuery";
import * as incidentsApi from "../services/api/incidents";

export function useIncidentHistory(params = {}) {
  const paramsKey = JSON.stringify(params);
  return useQuery(() => incidentsApi.getIncidents(params), [paramsKey]);
}

export function useIncidentDetails(id) {
  return useQuery(() => incidentsApi.getIncidentById(id), [id], {
    immediate: !!id,
  });
}

export function useUpdateIncidentStatus(onSuccess) {
  const [submitting, setSubmitting] = useState(false);

  const updateStatus = useCallback(
    async (id, payload) => {
      setSubmitting(true);
      try {
        const { data } = await incidentsApi.updateIncidentStatus(id, payload);
        toast.success(
          payload.status === "resolved"
            ? "Incident marked as resolved"
            : "Incident status updated",
        );
        onSuccess?.(data);
        return data;
      } catch {
        // Error toast handled by the axios interceptor
        return null;
      } finally {
        setSubmitting(false);
      }
    },
    [onSuccess],
  );

  return { updateStatus, submitting };
}
