import { useQuery } from "@tanstack/react-query";
import { fetchIncidents } from "../../api/incidents";
import { QUERY_KEYS } from "../../utils/constants";

export function useIncidents(filters = {}) {
  return useQuery({
    queryKey: [QUERY_KEYS.INCIDENTS, filters],
    queryFn: () => fetchIncidents(filters),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
    placeholderData: (prev) => prev,
  });
}
