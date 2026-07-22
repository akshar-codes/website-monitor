import { useState, useCallback } from "react";
import { useQuery } from "./useQuery";
import * as adminApi from "../services/api/admin";
import { toast } from "sonner";

export function useUserList(params = {}) {
  const paramsKey = JSON.stringify(params);
  return useQuery(() => adminApi.getUsers(params), [paramsKey]);
}

export function useUpdateUserRole(onSuccess) {
  const [submitting, setSubmitting] = useState(false);

  const updateRole = useCallback(
    async (userId, role, name) => {
      setSubmitting(true);
      try {
        await adminApi.updateUserRole(userId, role);
        toast.success(
          `${name ? `"${name}"'s` : "User"} role updated to ${role}`,
        );
        onSuccess?.();
      } catch {
        // Error toast handled by axios interceptor
      } finally {
        setSubmitting(false);
      }
    },
    [onSuccess],
  );

  return { updateRole, submitting };
}
