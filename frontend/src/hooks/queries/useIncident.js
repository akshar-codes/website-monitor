import { useQuery } from "@tanstack/react-query";
import { fetchIncident } from "../../api/incidents";
import { QUERY_KEYS } from "../../utils/constants";

export function useIncident(id) {
  return useQuery({
    queryKey: [QUERY_KEYS.INCIDENTS, id],
    queryFn: () => fetchIncident(id),
    staleTime: 30 * 1000,
    enabled: !!id,
  });
}
