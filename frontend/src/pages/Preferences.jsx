import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  usePreferences,
  usePreferenceMutations,
} from "../hooks/usePreferences";
import {
  THEME_OPTIONS,
  LANGUAGE_OPTIONS,
  DATE_FORMAT_OPTIONS,
  TIME_FORMAT_OPTIONS,
} from "../constants/preferences";

const generalSchema = z.object({
  theme: z.enum(THEME_OPTIONS.map((o) => o.value)),
  timezone: z.string().trim().min(1, "Timezone is required"),
  language: z.enum(LANGUAGE_OPTIONS.map((o) => o.value)),
  dateFormat: z.enum(DATE_FORMAT_OPTIONS.map((o) => o.value)),
  timeFormat: z.enum(TIME_FORMAT_OPTIONS.map((o) => o.value)),
});

const GENERAL_DEFAULTS = {
  theme: "dark",
  timezone: "UTC",
  language: "en",
  dateFormat: "MMM D, YYYY",
  timeFormat: "12h",
};

export default function Preferences() {
  const { preferences, loading } = usePreferences();
  const {
    savePreferences,
    saveDashboardPreferences,
    resetAllPreferences,
    submitting,
    submittingDashboard,
    resetting,
  } = usePreferenceMutations();

  const [dashboardState, setDashboardState] = useState({
    source: preferences,
    value: preferences?.dashboard || null,
  });
  const dashboardDraft =
    dashboardState.source === preferences
      ? dashboardState.value
      : preferences?.dashboard || null;
  const setDashboardDraft = (value) =>
    setDashboardState({ source: preferences, value });
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

  const {
    control,
    setValue,
    handleSubmit,
    reset,
    formState: { isDirty },
  } = useForm({
    resolver: zodResolver(generalSchema),
    defaultValues: GENERAL_DEFAULTS,
  });

  // Re-hydrate the form and the dashboard draft whenever fresh preferences
  // load (initial fetch, or after a reset), so unsaved local edits from a
  // prior render never linger across a refetch.
  useEffect(() => {
    if (!preferences) return;

    reset({
      theme: preferences.theme,
      timezone: preferences.timezone,
      language: preferences.language,
      dateFormat: preferences.dateFormat,
      timeFormat: preferences.timeFormat,
    });
  }, [preferences, reset]);

  const theme = useWatch({ control, name: "theme" });
  const timezone = useWatch({ control, name: "timezone" });
  const language = useWatch({ control, name: "language" });
  const dateFormat = useWatch({ control, name: "dateFormat" });
  const timeFormat = useWatch({ control, name: "timeFormat" });

  const onSubmitGeneral = async (data) => {
    const result = await savePreferences(data);
    if (result) reset(data);
  };

  const handleSaveDashboard = async () => {
    if (!dashboardDraft) return;
    await saveDashboardPreferences(dashboardDraft);
  };

  const handleReset = async () => {
    const ok = await resetAllPreferences();
    if (ok) setConfirmResetOpen(false);
  };

  return null;
}
