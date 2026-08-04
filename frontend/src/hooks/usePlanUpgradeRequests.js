import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useQuery } from "./useQuery";
import * as planUpgradeRequestsApi from "../services/api/planUpgradeRequests";

/**
 * The caller's currently pending upgrade request (if any) plus recent
 * history — backs the Billing page's pending-state banner and disables
 * further plan actions while a request is outstanding.
 */
export function useMyPlanUpgradeRequest() {
  return useQuery(() => planUpgradeRequestsApi.getMyPlanUpgradeRequests(), []);
}

export function useRequestPlanUpgrade(onSuccess) {
  const [submitting, setSubmitting] = useState(false);

  const requestUpgrade = useCallback(
    async (plan) => {
      setSubmitting(true);
      try {
        const { data, message } =
          await planUpgradeRequestsApi.requestPlanUpgrade(plan);
        toast.success(message || "Upgrade request submitted");
        await onSuccess?.(data);
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

  return { requestUpgrade, submitting };
}
