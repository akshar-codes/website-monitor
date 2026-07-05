import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateIncidentStatus } from "../../api/incidents";
import { QUERY_KEYS } from "../../utils/constants";
import toast from "react-hot-toast";

export function useUpdateIncidentStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }) => updateIncidentStatus(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.INCIDENTS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.DASHBOARD] });
      toast.success("Incident status updated");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update incident status");
    },
  });
}
