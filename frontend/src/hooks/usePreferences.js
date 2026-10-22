import { useCallback, useContext, useState } from "react";
import { toast } from "sonner";
import { PreferencesContext } from "../context/PreferencesContext";
import * as preferencesApi from "../services/api/preferences";

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error("usePreferences must be used within a PreferencesProvider");
  }
  return context;
}

/**
 * Mutation handlers for the Preferences page — each updates the shared
 * PreferencesContext cache on success via `updateLocal` so every consumer
 * (sidebar, future format-aware components) sees the change immediately
 * without a second fetch.
 */
export function usePreferenceMutations() {
  const { updateLocal, refetchPreferences } = usePreferences();

  const [submitting, setSubmitting] = useState(false);
  const [submittingDashboard, setSubmittingDashboard] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [submittingNotifications, setSubmittingNotifications] = useState(false);

  const saveNotificationPreferences = useCallback(
    async (payload) => {
      setSubmittingNotifications(true);
      try {
        const { data, message } =
          await preferencesApi.updateNotificationPreferences(payload);
        updateLocal(data);
        toast.success(message || "Notification settings saved");
        return data;
      } catch {
        return null;
      } finally {
        setSubmittingNotifications(false);
      }
    },
    [updateLocal],
  );

  const savePreferences = useCallback(
    async (payload) => {
      setSubmitting(true);
      try {
        const { data, message } =
          await preferencesApi.updatePreferences(payload);
        updateLocal(data);
        toast.success(message || "Preferences saved");
        return data;
      } catch {
        // Error toast handled by the axios interceptor
        return null;
      } finally {
        setSubmitting(false);
      }
    },
    [updateLocal],
  );

  const saveDashboardPreferences = useCallback(
    async (payload) => {
      setSubmittingDashboard(true);
      try {
        const { data, message } =
          await preferencesApi.updateDashboardPreferences(payload);
        updateLocal(data);
        toast.success(message || "Dashboard preferences saved");
        return data;
      } catch {
        return null;
      } finally {
        setSubmittingDashboard(false);
      }
    },
    [updateLocal],
  );

  const resetAllPreferences = useCallback(async () => {
    setResetting(true);
    try {
      const { message } = await preferencesApi.resetPreferences();
      await refetchPreferences();
      toast.success(message || "Preferences reset to defaults");
      return true;
    } catch {
      return false;
    } finally {
      setResetting(false);
    }
  }, [refetchPreferences]);

  return {
    savePreferences,
    saveDashboardPreferences,
    resetAllPreferences,
    submitting,
    submittingDashboard,
    resetting,
    saveNotificationPreferences,
    submittingNotifications,
  };
}
