import { useQuery } from "@tanstack/react-query";
import { fetchMonitors } from "../../api/monitors";
import { QUERY_KEYS } from "../../utils/constants";

export function useMonitors(filters = {}) {
  return useQuery({
    queryKey: [QUERY_KEYS.MONITORS, filters],
    queryFn: () => fetchMonitors(filters),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
    placeholderData: (prev) => prev,
  });
}
