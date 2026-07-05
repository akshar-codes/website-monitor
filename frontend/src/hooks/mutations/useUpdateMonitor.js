import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateMonitor } from "../../api/monitors";
import { QUERY_KEYS } from "../../utils/constants";
import toast from "react-hot-toast";

export function useUpdateMonitor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }) => updateMonitor(id, data),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.MONITORS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.MONITORS, id] });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.MONITOR_STATS, id],
      });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.DASHBOARD] });
      toast.success("Monitor updated successfully");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update monitor");
    },
  });
}
