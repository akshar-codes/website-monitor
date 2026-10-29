import { useCallback } from "react";
import { useProfile, useProfileMutations } from "../hooks/useProfile";
import { useAuth } from "../hooks/useAuth";

export default function Profile() {
  const { data: profileData, loading, refetch } = useProfile();
  const { refetchUser } = useAuth();
  const profile = profileData?.data;

  // Keeps both the profile page's own query AND the app-wide AuthContext
  // user in sync after any mutation — name/avatarUrl are surfaced in the
  // sidebar (see components/layout/Sidebar.jsx), which reads from
  // AuthContext rather than this page's local state.
  const handleMutationSuccess = useCallback(() => {
    refetch();
    refetchUser();
  }, [refetch, refetchUser]);

  const {
    updateProfile,
    uploadAvatar,
    deleteAvatar,
    submitting,
    avatarSubmitting,
  } = useProfileMutations(handleMutationSuccess);

  return null;
}
