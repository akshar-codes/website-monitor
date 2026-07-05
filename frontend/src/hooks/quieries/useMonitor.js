import { useQuery } from "@tanstack/react-query";
import { fetchMonitor } from "../../api/monitors";
import { QUERY_KEYS } from "../../utils/constants";

export function useMonitor(id) {
  return useQuery({
    queryKey: [QUERY_KEYS.MONITORS, id],
    queryFn: () => fetchMonitor(id),
    staleTime: 30 * 1000,
    enabled: !!id,
  });
}
