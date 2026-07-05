import { useQuery } from "@tanstack/react-query";
import { fetchRecentHealthChecks } from "../../api/dashboard";
import { QUERY_KEYS } from "../../utils/constants";

export function useHealthChecks(filters = {}) {
  return useQuery({
    queryKey: [QUERY_KEYS.HEALTH_CHECKS, filters],
    queryFn: () => fetchRecentHealthChecks(filters),
    staleTime: 30 * 1000,
    enabled:
      filters.monitorId !== undefined ||
      filters.status !== undefined ||
      Object.keys(filters).length === 0,
  });
}
