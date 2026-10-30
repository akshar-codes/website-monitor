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
  COMMON_TIMEZONES,
  WIDGET_KEYS,
  WIDGET_LABELS,
  DEFAULT_WINDOW_OPTIONS,
} from "../constants/preferences";
import {
  Page,
  Panel,
  Button,
  Select,
  Notice,
} from "../components/ui/Primitives";
import { Save, RotateCcw, Eye } from "lucide-react";

const generalSchema = z.object({
  theme: z.enum(THEME_OPTIONS.map((o) => o.value)),
  timezone: z.string().trim().min(1, "Timezone is required"),
  language: z.enum(LANGUAGE_OPTIONS.map((o) => o.value)),
  dateFormat: z.enum(DATE_FORMAT_OPTIONS.map((o) => o.value)),
  timeFormat: z.enum(TIME_FORMAT_OPTIONS.map((o) => o.value)),
});

const GENERAL_DEFAULTS = {
  theme: "light",
  timezone: "UTC",
  language: "en",
  dateFormat: "MMM D, YYYY",
  timeFormat: "12h",
};

export default function Preferences() {
  const { preferences, loading: _loading } = usePreferences();
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
      theme: "light",
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
    const lightModeData = { ...data, theme: "light" };
    const result = await savePreferences(lightModeData);
    if (result) reset(lightModeData);
  };

  const handleSaveDashboard = async () => {
    if (!dashboardDraft) return;
    await saveDashboardPreferences(dashboardDraft);
  };

  const handleReset = async () => {
    const ok = await resetAllPreferences();
    if (ok) setConfirmResetOpen(false);
  };

  const options = (items) =>
    items.map((item) => (
      <option key={item.value} value={item.value}>
        {item.label}
      </option>
    ));
  return (
    <Page
      title="Preferences"
      description="Set your locale, appearance, and dashboard defaults."
      eyebrow="SETTINGS"
    >
      <form onSubmit={handleSubmit(onSubmitGeneral)}>
        <Panel
          title="Appearance and locale"
          subtitle="These choices apply throughout SiteWatch"
        >
          <div className="settings-grid">
            <label className="sw-field">
              Theme
              <select value="light" disabled aria-describedby="light-mode-note">
                <option value="light">Light</option>
              </select>
              <small id="light-mode-note">
                SiteWatch uses light mode throughout.
              </small>
            </label>
            <label className="sw-field">
              Timezone
              <select
                value={timezone || "UTC"}
                onChange={(e) =>
                  setValue("timezone", e.target.value, { shouldDirty: true })
                }
              >
                {COMMON_TIMEZONES.map((zone) => (
                  <option key={zone}>{zone}</option>
                ))}
              </select>
            </label>
            <label className="sw-field">
              Language
              <select
                value={language || "en"}
                onChange={(e) =>
                  setValue("language", e.target.value, { shouldDirty: true })
                }
              >
                {options(LANGUAGE_OPTIONS)}
              </select>
            </label>
            <label className="sw-field">
              Date format
              <select
                value={dateFormat || "MMM D, YYYY"}
                onChange={(e) =>
                  setValue("dateFormat", e.target.value, { shouldDirty: true })
                }
              >
                {options(DATE_FORMAT_OPTIONS)}
              </select>
            </label>
            <label className="sw-field">
              Time format
              <select
                value={timeFormat || "12h"}
                onChange={(e) =>
                  setValue("timeFormat", e.target.value, { shouldDirty: true })
                }
              >
                {options(TIME_FORMAT_OPTIONS)}
              </select>
            </label>
          </div>
          <div className="form-actions">
            <Button disabled={submitting || !isDirty}>
              <Save size={14} />
              {submitting ? "Saving…" : "Save preferences"}
            </Button>
          </div>
        </Panel>
      </form>
      <Panel
        title="Dashboard defaults"
        subtitle="Choose the widgets shown when you open your dashboard"
        actions={
          <Button variant="secondary" onClick={() => setConfirmResetOpen(true)}>
            <RotateCcw size={14} /> Reset preferences
          </Button>
        }
      >
        <div className="settings-grid">
          <Select
            label="Auto refresh"
            value={dashboardDraft?.autoRefreshInterval || 30}
            onChange={(e) =>
              setDashboardDraft({
                ...dashboardDraft,
                autoRefreshInterval: Number(e.target.value),
              })
            }
          >
            {[10, 30, 60, 300].map((value) => (
              <option value={value} key={value}>
                {value < 60
                  ? `${value} seconds`
                  : `${value / 60} minute${value === 60 ? "" : "s"}`}
              </option>
            ))}
          </Select>
          <Select
            label="Default chart window"
            value={dashboardDraft?.defaultWindow || "7d"}
            onChange={(e) =>
              setDashboardDraft({
                ...dashboardDraft,
                defaultWindow: e.target.value,
              })
            }
          >
            {DEFAULT_WINDOW_OPTIONS.map((item) => (
              <option value={item.value} key={item.value}>
                {item.label}
              </option>
            ))}
          </Select>
          <label className="preference-row">
            <span>
              <b>Compact mode</b>
              <small>Fit more dashboard rows on screen.</small>
            </span>
            <input
              type="checkbox"
              checked={!!dashboardDraft?.compactMode}
              onChange={(e) =>
                setDashboardDraft({
                  ...dashboardDraft,
                  compactMode: e.target.checked,
                })
              }
            />
          </label>
        </div>
        <h3 className="subsection-title">
          <Eye size={15} /> Visible widgets
        </h3>
        <div className="settings-grid">
          {WIDGET_KEYS.map((key) => (
            <label className="preference-row" key={key}>
              <span>
                <b>{WIDGET_LABELS[key]}</b>
                <small>Show this section on your dashboard.</small>
              </span>
              <input
                type="checkbox"
                checked={
                  dashboardDraft?.widgets?.[
                    `show${key[0].toUpperCase()}${key.slice(1)}`
                  ] !== false
                }
                onChange={(e) =>
                  setDashboardDraft({
                    ...dashboardDraft,
                    widgets: {
                      ...dashboardDraft.widgets,
                      [`show${key[0].toUpperCase()}${key.slice(1)}`]:
                        e.target.checked,
                    },
                  })
                }
              />
            </label>
          ))}
        </div>
        <div className="form-actions">
          <Button
            disabled={submittingDashboard || !dashboardDraft}
            onClick={handleSaveDashboard}
          >
            {submittingDashboard ? "Saving…" : "Save dashboard defaults"}
          </Button>
        </div>
      </Panel>
      {confirmResetOpen && (
        <div className="modal-backdrop">
          <section className="form-modal">
            <h2>Reset all preferences?</h2>
            <p className="muted-copy">
              This restores theme, locale, notifications, and dashboard settings
              to their defaults.
            </p>
            <div className="modal-actions">
              <Button
                variant="secondary"
                onClick={() => setConfirmResetOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                disabled={resetting}
                onClick={handleReset}
              >
                {resetting ? "Resetting…" : "Reset preferences"}
              </Button>
            </div>
          </section>
        </div>
      )}
      <Notice tone="info">
        Selected theme: {theme || "—"} · Timezone: {timezone || "UTC"}
      </Notice>
    </Page>
  );
}
