import { useQuery } from "@tanstack/react-query";
import { fetchMonitorStats } from "../../api/dashboard";
import { QUERY_KEYS } from "../../utils/constants";

export function useMonitorStats(id, window = "24h") {
  return useQuery({
    queryKey: [QUERY_KEYS.MONITOR_STATS, id, window],
    queryFn: () => fetchMonitorStats(id, { window }),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
    enabled: !!id,
  });
}
