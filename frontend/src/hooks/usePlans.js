import { useCallback, useState } from "react";
import { useQuery } from "./useQuery";
import * as plansApi from "../services/api/plans";
import { toast } from "sonner";

export function usePlanCatalog() {
  return useQuery(() => plansApi.getPlanCatalog(), []);
}

export function useCurrentPlan() {
  return useQuery(() => plansApi.getCurrentPlan(), []);
}

export function usePlanChange(onSuccess) {
  const [submitting, setSubmitting] = useState(false);

  const changePlan = useCallback(
    async (plan) => {
      setSubmitting(true);
      try {
        const { data, message } = await plansApi.changePlan(plan);
        toast.success(message || "Plan updated successfully");
        onSuccess?.(data);
        return data;
      } catch {
        // Error toast handled by axios interceptor
        return null;
      } finally {
        setSubmitting(false);
      }
    },
    [onSuccess],
  );

  return { changePlan, submitting };
}
