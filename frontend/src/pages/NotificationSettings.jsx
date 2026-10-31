import { useState } from "react";
import {
  usePreferences,
  usePreferenceMutations,
} from "../hooks/usePreferences";
import { Page, Panel, Button, Select } from "../components/ui/Primitives";
import { Save, RotateCcw } from "lucide-react";

const DEFAULTS = {
  inApp: {
    monitorDown: true,
    monitorRecovery: true,
    performanceAlerts: true,
    sslExpiry: true,
    incidents: true,
    billing: true,
    accountSecurity: true,
    systemAnnouncements: true,
  },
  email: {
    enabled: false,
    monitorDown: true,
    monitorRecovery: true,
    performanceAlerts: true,
    sslExpiry: true,
    incidents: true,
  },
  frequency: "immediate",
};
const sections = [
  {
    key: "monitorDown",
    label: "Monitor down",
    help: "When a monitor becomes unavailable.",
  },
  {
    key: "monitorRecovery",
    label: "Monitor recovery",
    help: "When a down monitor returns to service.",
  },
  {
    key: "sslExpiry",
    label: "SSL and domain expiry",
    help: "Certificate and domain expiry warnings.",
  },
  {
    key: "incidents",
    label: "Incidents",
    help: "Incident opened and resolved updates.",
  },
  {
    key: "performanceAlerts",
    label: "Performance degradation",
    help: "Sustained response-time degradation and recovery.",
  },
];

export default function NotificationSettings() {
  const { preferences, loading } = usePreferences();
  const { saveNotificationPreferences, submittingNotifications } =
    usePreferenceMutations();
  const notifications = preferences?.notifications;
  const normalized = notifications
    ? {
        ...DEFAULTS,
        ...notifications,
        inApp: { ...DEFAULTS.inApp, ...notifications.inApp },
        email: { ...DEFAULTS.email, ...notifications.email },
      }
    : DEFAULTS;
  const [draftOverride, setDraftOverride] = useState({
    source: notifications,
    value: normalized,
  });
  const draft =
    draftOverride.source === notifications ? draftOverride.value : normalized;
  const updateDraft = (updater) =>
    setDraftOverride({
      source: notifications,
      value: typeof updater === "function" ? updater(draft) : updater,
    });

  const setGroupValue = (group, key, value) =>
    updateDraft((current) => ({
      ...current,
      [group]: { ...current[group], [key]: value },
    }));
  const save = async (event) => {
    event.preventDefault();
    await saveNotificationPreferences(draft);
  };
  const reset = async () => {
    const result = await saveNotificationPreferences(DEFAULTS);
    if (result) updateDraft(DEFAULTS);
  };

  return (
    <Page
      title="Notification settings"
      description="Choose which updates you receive and where they arrive."
      eyebrow="SETTINGS"
    >
      <form onSubmit={save}>
        <div className="two-panel-grid">
          <Panel
            title="In-app alerts"
            subtitle="Notifications inside SiteWatch"
          >
            <div className="preference-list">
              {sections.map((item) => (
                <label className="preference-row" key={item.key}>
                  <span>
                    <b>{item.label}</b>
                    <small>{item.help}</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={!!draft.inApp[item.key]}
                    onChange={(e) =>
                      setGroupValue("inApp", item.key, e.target.checked)
                    }
                  />
                </label>
              ))}
              {["billing", "accountSecurity", "systemAnnouncements"].map(
                (key) => (
                  <label className="preference-row" key={key}>
                    <span>
                      <b>{key.replace(/([A-Z])/g, " $1")}</b>
                      <small>
                        Important account updates and announcements.
                      </small>
                    </span>
                    <input
                      type="checkbox"
                      checked={!!draft.inApp[key]}
                      onChange={(e) =>
                        setGroupValue("inApp", key, e.target.checked)
                      }
                    />
                  </label>
                ),
              )}
            </div>
          </Panel>
          <Panel
            title="Email alerts"
            subtitle="Send important notifications to your inbox"
          >
            <label className="preference-row email-master">
              <span>
                <b>Email notifications</b>
                <small>Turn email delivery on or off.</small>
              </span>
              <input
                type="checkbox"
                checked={!!draft.email.enabled}
                onChange={(e) =>
                  setGroupValue("email", "enabled", e.target.checked)
                }
              />
            </label>
            <div
              className={
                draft.email.enabled
                  ? "preference-list"
                  : "preference-list disabled"
              }
            >
              {sections.map((item) => (
                <label className="preference-row" key={item.key}>
                  <span>
                    <b>{item.label}</b>
                    <small>{item.help}</small>
                  </span>
                  <input
                    type="checkbox"
                    disabled={!draft.email.enabled}
                    checked={!!draft.email[item.key]}
                    onChange={(e) =>
                      setGroupValue("email", item.key, e.target.checked)
                    }
                  />
                </label>
              ))}
            </div>
            <Select
              label="Email frequency"
              value={draft.frequency}
              onChange={(e) =>
                updateDraft({ ...draft, frequency: e.target.value })
              }
            >
              <option value="immediate">Immediately</option>
              <option value="hourly">Hourly digest</option>
              <option value="daily">Daily digest</option>
            </Select>
          </Panel>
        </div>
        <div className="form-actions">
          <Button type="submit" disabled={loading || submittingNotifications}>
            <Save size={14} />
            {submittingNotifications ? "Saving…" : "Save notification settings"}
          </Button>
          <Button
            variant="secondary"
            type="button"
            disabled={submittingNotifications}
            onClick={reset}
          >
            <RotateCcw size={14} /> Reset defaults
          </Button>
        </div>
      </form>
    </Page>
  );
}
