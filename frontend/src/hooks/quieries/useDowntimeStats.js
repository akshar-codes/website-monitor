import { useQuery } from "@tanstack/react-query";
import { fetchDowntimeStats } from "../../api/incidents";
import { QUERY_KEYS } from "../../utils/constants";

export function useDowntimeStats({ monitorId, window = "30d" } = {}) {
  return useQuery({
    queryKey: [QUERY_KEYS.INCIDENTS, "downtime-stats", monitorId, window],
    queryFn: () => fetchDowntimeStats({ monitorId, window }),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}
