import { useCallback } from "react";
import PageContainer from "../components/layout/PageContainer";
import PageHeader from "../components/layout/PageHeader";
import { Card } from "../components/ui/Card";
import AvatarUpload from "../components/profile/AvatarUpload";
import ProfileCompletionIndicator from "../components/profile/ProfileCompletionIndicator";
import ProfileForm from "../features/profile/ProfileForm";
import AccountInfoCard from "../features/profile/AccountInfoCard";
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

  return (
    <PageContainer>
      <PageHeader
        title="Profile"
        subtitle="Manage your personal information and how others see you"
        className="mb-6"
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <AvatarUpload
              avatarUrl={profile?.avatarUrl}
              name={profile?.name}
              onUpload={uploadAvatar}
              onDelete={deleteAvatar}
              uploading={avatarSubmitting}
            />
          </Card>

          <Card>
            {loading && !profile ? (
              <div className="space-y-4">
                <div className="h-4 w-32 animate-pulse rounded bg-bg-overlay" />
                <div className="h-24 w-full animate-pulse rounded bg-bg-overlay" />
              </div>
            ) : (
              <ProfileForm
                profile={profile}
                onSubmit={updateProfile}
                submitting={submitting}
              />
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <ProfileCompletionIndicator
            completion={profile?.profileCompletion}
            loading={loading && !profile}
          />
          <AccountInfoCard profile={profile} loading={loading && !profile} />
        </div>
      </div>
    </PageContainer>
  );
}
