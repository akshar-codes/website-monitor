import { useQuery } from "@tanstack/react-query";
import { fetchServerHealth } from "../../api/health";
import { QUERY_KEYS } from "../../utils/constants";

export function useServerHealth() {
  return useQuery({
    queryKey: [QUERY_KEYS.SERVER_HEALTH],
    queryFn: fetchServerHealth,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}
