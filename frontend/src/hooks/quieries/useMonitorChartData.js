import { useQuery } from "@tanstack/react-query";
import { fetchMonitorChartData } from "../../api/dashboard";
import { QUERY_KEYS } from "../../utils/constants";

export function useMonitorChartData(id, window = "24h") {
  return useQuery({
    queryKey: [QUERY_KEYS.MONITOR_STATS, "chart-data", id, window],
    queryFn: () => fetchMonitorChartData(id, { window }),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
    enabled: !!id,
  });
}
