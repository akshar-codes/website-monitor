import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteMonitor } from "../../api/monitors";
import { QUERY_KEYS } from "../../utils/constants";
import toast from "react-hot-toast";

export function useDeleteMonitor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteMonitor,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.MONITORS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.DASHBOARD] });
      toast.success("Monitor deleted successfully");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete monitor");
    },
  });
}
