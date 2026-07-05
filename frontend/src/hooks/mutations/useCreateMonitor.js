import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createMonitor } from "../../api/monitors";
import { QUERY_KEYS } from "../../utils/constants";
import toast from "react-hot-toast";

export function useCreateMonitor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createMonitor,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.MONITORS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.DASHBOARD] });
      toast.success("Monitor created successfully");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create monitor");
    },
  });
}
