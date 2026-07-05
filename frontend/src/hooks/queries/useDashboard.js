import { useQuery } from "@tanstack/react-query";
import { fetchDashboard } from "../../api/dashboard";
import { QUERY_KEYS } from "../../utils/constants";

export function useDashboard() {
  return useQuery({
    queryKey: [QUERY_KEYS.DASHBOARD],
    queryFn: fetchDashboard,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}
