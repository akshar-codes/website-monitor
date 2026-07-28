import { useState, useCallback } from "react";
import { useQuery } from "./useQuery";
import * as profileApi from "../services/api/profile";
import { toast } from "sonner";

export function useProfile() {
  return useQuery(() => profileApi.getProfile(), []);
}

export function usePublicProfile(userId) {
  return useQuery(() => profileApi.getPublicProfile(userId), [userId], {
    immediate: !!userId,
  });
}

/**
 * `onSuccess(data)` fires after every successful mutation (update, avatar
 * upload, avatar delete) so the caller can refresh the profile query and
 * the cached AuthContext user (name/avatarUrl appear in both) in one
 * place — see pages/Profile.jsx.
 */
export function useProfileMutations(onSuccess) {
  const [submitting, setSubmitting] = useState(false);
  const [avatarSubmitting, setAvatarSubmitting] = useState(false);

  const updateProfile = useCallback(
    async (payload) => {
      setSubmitting(true);
      try {
        const { data, message } = await profileApi.updateProfile(payload);
        toast.success(message || "Profile updated successfully");
        onSuccess?.(data);
        return data;
      } catch {
        // Error toast handled by the axios interceptor
        return null;
      } finally {
        setSubmitting(false);
      }
    },
    [onSuccess],
  );

  const uploadAvatar = useCallback(
    async (file) => {
      setAvatarSubmitting(true);
      try {
        const { data, message } = await profileApi.uploadAvatar(file);
        toast.success(message || "Avatar uploaded successfully");
        onSuccess?.(data);
        return data;
      } catch {
        return null;
      } finally {
        setAvatarSubmitting(false);
      }
    },
    [onSuccess],
  );

  const deleteAvatar = useCallback(async () => {
    setAvatarSubmitting(true);
    try {
      const { data, message } = await profileApi.deleteAvatar();
      toast.success(message || "Avatar removed successfully");
      onSuccess?.(data);
      return data;
    } catch {
      return null;
    } finally {
      setAvatarSubmitting(false);
    }
  }, [onSuccess]);

  return {
    updateProfile,
    uploadAvatar,
    deleteAvatar,
    submitting,
    avatarSubmitting,
  };
}
