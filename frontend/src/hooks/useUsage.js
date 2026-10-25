import { usePolling } from "./useQuery";
import * as usageApi from "../services/api/usage";

/**
 * Polls the current user's plan usage — monitor count vs. limit, minimum
 * check interval, data retention window, team seat cap, and feature
 * flags. Backs the usage dashboard, the remaining-monitor indicator on
 * the Monitors page, and every upgrade prompt.
 */
export function useUsage(pollingInterval = 300000) {
  return usePolling(() => usageApi.getUsage(), [], pollingInterval);
}
