import { useCallback } from "react";
import { useProfile, useProfileMutations } from "../hooks/useProfile";
import { useAuth } from "../hooks/useAuth";
import {
  Page,
  Panel,
  Button,
  Input,
  Notice,
} from "../components/ui/Primitives";
import { Camera, Trash2, UserRound, Save } from "lucide-react";

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

  const submit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await updateProfile({
      name: form.get("name"),
      bio: form.get("bio"),
      location: form.get("location"),
      website: form.get("website"),
    });
  };
  const avatarChange = (event) => {
    const file = event.target.files?.[0];
    if (file) uploadAvatar(file);
  };
  return (
    <Page
      title="Profile"
      description="Manage the name, photo, and details shown on your account."
      eyebrow="SETTINGS"
    >
      {loading ? (
        <div className="sw-loading">Loading profile…</div>
      ) : (
        <div className="settings-layout">
          <aside className="settings-intro">
            <span className="settings-avatar">
              {profile?.avatarUrl ? (
                <img src={profile.avatarUrl} alt="Profile" />
              ) : (
                <UserRound size={24} />
              )}
            </span>
            <b>{profile?.name || "Your profile"}</b>
            <small>{profile?.email}</small>
            <label className="sw-button secondary avatar-upload">
              <Camera size={14} />
              {avatarSubmitting ? "Uploading…" : "Change photo"}
              <input
                type="file"
                accept="image/*"
                onChange={avatarChange}
                disabled={avatarSubmitting}
              />
            </label>
            {profile?.avatarUrl && (
              <Button
                variant="ghost"
                onClick={deleteAvatar}
                disabled={avatarSubmitting}
              >
                <Trash2 size={13} /> Remove photo
              </Button>
            )}
          </aside>
          <Panel
            title="Public profile"
            subtitle="This information helps identify your account"
          >
            <form className="settings-form" onSubmit={submit}>
              <Input
                label="Display name"
                name="name"
                placeholder="e.g. Alex Morgan"
                defaultValue={profile?.name}
                required
              />
              <label className="sw-field">
                About you
                <textarea
                  rows="4"
                  name="bio"
                  placeholder="Tell us a little about yourself or your team..."
                  defaultValue={profile?.bio || ""}
                  maxLength={500}
                />
              </label>
              <Input
                label="Location"
                name="location"
                placeholder="e.g. London, UK or Remote"
                defaultValue={profile?.location || ""}
              />
              <Input
                label="Website"
                name="website"
                type="url"
                placeholder="https://example.com"
                defaultValue={profile?.website || ""}
              />
              <Notice tone="info">
                Your email address is managed in account settings.
              </Notice>
              <Button disabled={submitting}>
                <Save size={14} />
                {submitting ? "Saving…" : "Save profile"}
              </Button>
            </form>
          </Panel>
        </div>
      )}
    </Page>
  );
}
