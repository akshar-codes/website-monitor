import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Save, RotateCcw } from "lucide-react";
import PageContainer from "../components/layout/PageContainer";
import PageHeader from "../components/layout/PageHeader";
import { Card } from "../components/ui/Card";
import { FormField } from "../components/ui/Input";
import Button from "../components/ui/Button";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import ThemeSelector from "../features/preferences/ThemeSelector";
import TimezoneSelector from "../features/preferences/TimezoneSelector";
import LanguageSelector from "../features/preferences/LanguageSelector";
import DateTimeFormatSelector from "../features/preferences/DateTimeFormatSelector";
import DashboardCustomization from "../features/preferences/DashboardCustomization";
import { usePreferences, usePreferenceMutations } from "../hooks/usePreferences";
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

  const [dashboardDraft, setDashboardDraft] = useState(null);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

  const {
    watch,
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
    setDashboardDraft(preferences.dashboard);
  }, [preferences, reset]);

  const theme = watch("theme");
  const timezone = watch("timezone");
  const language = watch("language");
  const dateFormat = watch("dateFormat");
  const timeFormat = watch("timeFormat");

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

  if (loading && !preferences) {
    return (
      <PageContainer>
        <PageHeader
          title="Preferences"
          subtitle="Personalize your WebMonitor experience"
          className="mb-6"
        />
        <div className="space-y-4">
          <div className="h-56 w-full animate-pulse rounded-xl bg-bg-overlay" />
          <div className="h-72 w-full animate-pulse rounded-xl bg-bg-overlay" />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Preferences"
        subtitle="Personalize your WebMonitor experience"
        actions={
          <Button
            variant="ghost"
            size="sm"
            icon={RotateCcw}
            onClick={() => setConfirmResetOpen(true)}
          >
            Reset to defaults
          </Button>
        }
        className="mb-6"
      />

      <form onSubmit={handleSubmit(onSubmitGeneral)} className="space-y-6">
        <Card>
          <p className="mb-1 text-sm font-semibold text-white">Appearance</p>
          <p className="mb-4 text-xs text-text-muted">
            Choose how WebMonitor looks for you
          </p>
          <ThemeSelector
            value={theme}
            onChange={(v) => setValue("theme", v, { shouldDirty: true })}
            disabled={submitting}
          />
        </Card>

        <Card>
          <p className="mb-1 text-sm font-semibold text-white">
            Region &amp; language
          </p>
          <p className="mb-4 text-xs text-text-muted">
            Controls timestamps, locale-specific formatting, and interface
            language
          </p>

          <div className="space-y-4">
            <FormField label="Timezone">
              <TimezoneSelector
                value={timezone}
                onChange={(v) => setValue("timezone", v, { shouldDirty: true })}
                disabled={submitting}
              />
            </FormField>

            <FormField label="Language">
              <LanguageSelector
                value={language}
                onChange={(v) => setValue("language", v, { shouldDirty: true })}
                disabled={submitting}
              />
            </FormField>

            <DateTimeFormatSelector
              dateFormat={dateFormat}
              timeFormat={timeFormat}
              onDateFormatChange={(v) =>
                setValue("dateFormat", v, { shouldDirty: true })
              }
              onTimeFormatChange={(v) =>
                setValue("timeFormat", v, { shouldDirty: true })
              }
              disabled={submitting}
            />
          </div>

          <div className="mt-5 flex justify-end border-t border-border-subtle pt-4">
            <Button
              type="submit"
              variant="primary"
              icon={Save}
              loading={submitting}
              disabled={submitting || !isDirty}
            >
              Save changes
            </Button>
          </div>
        </Card>
      </form>

      {dashboardDraft && (
        <Card className="mt-6">
          <p className="mb-1 text-sm font-semibold text-white">
            Dashboard customization
          </p>
          <p className="mb-4 text-xs text-text-muted">
            Control what shows on your dashboard and how often it refreshes
          </p>
          <DashboardCustomization
            dashboard={dashboardDraft}
            onChange={setDashboardDraft}
            onSave={handleSaveDashboard}
            saving={submittingDashboard}
          />
        </Card>
      )}

      <ConfirmDialog
        open={confirmResetOpen}
        onClose={() => setConfirmResetOpen(false)}
        onConfirm={handleReset}
        title="Reset preferences to defaults?"
        description="This restores the default theme, timezone, language, formats, and dashboard layout. This cannot be undone."
        confirmLabel="Reset preferences"
        loading={resetting}
      />
    </PageContainer>
  );
}
