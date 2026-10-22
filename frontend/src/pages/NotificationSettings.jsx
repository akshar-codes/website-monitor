import { useState } from "react";
import { Bell, Mail, RotateCcw, Save } from "lucide-react";
import PageContainer from "../components/layout/PageContainer";
import PageHeader from "../components/layout/PageHeader";
import { Card } from "../components/ui/Card";
import Button from "../components/ui/Button";
import {
  usePreferences,
  usePreferenceMutations,
} from "../hooks/usePreferences";

const DEFAULTS = {
  inApp: {
    monitorDown: true,
    monitorRecovery: true,
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
];

function Toggle({ checked, onChange, label }) {
  return (
    <input
      aria-label={label}
      type="checkbox"
      checked={!!checked}
      onChange={(e) => onChange(e.target.checked)}
      className="size-4 accent-emerald-500"
    />
  );
}

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
    <PageContainer>
      <PageHeader
        title="Notification settings"
        subtitle="Choose which monitoring updates appear in your inbox and arrive by email."
      />
      {loading ? (
        <Card className="p-6">
          <p className="text-sm text-text-muted">
            Loading notification preferences…
          </p>
        </Card>
      ) : (
        <form onSubmit={save} className="space-y-5">
          <Card className="p-5 sm:p-6">
            <div className="mb-5 flex items-center gap-3">
              <Bell className="text-emerald-400" size={19} />
              <div>
                <h2 className="font-semibold text-white">In-app alerts</h2>
                <p className="text-sm text-text-muted">
                  Choose the alert categories shown in your notification center.
                </p>
              </div>
            </div>
            <div className="divide-y divide-border-subtle">
              {[
                ...sections,
                {
                  key: "billing",
                  label: "Billing and usage",
                  help: "Plan changes and usage limit notifications.",
                },
                {
                  key: "accountSecurity",
                  label: "Account security",
                  help: "Important security events for your account.",
                },
                {
                  key: "systemAnnouncements",
                  label: "Product announcements",
                  help: "Service and product notices.",
                },
              ].map((item) => (
                <label
                  key={item.key}
                  className="flex cursor-pointer items-center justify-between gap-4 py-3"
                >
                  <span>
                    <span className="block text-sm font-medium text-white">
                      {item.label}
                    </span>
                    <span className="text-xs text-text-muted">{item.help}</span>
                  </span>
                  <Toggle
                    label={`${item.label} in-app alerts`}
                    checked={draft.inApp[item.key]}
                    onChange={(value) =>
                      setGroupValue("inApp", item.key, value)
                    }
                  />
                </label>
              ))}
            </div>
          </Card>
          <Card className="p-5 sm:p-6">
            <div className="mb-5 flex items-center gap-3">
              <Mail className="text-emerald-400" size={19} />
              <div>
                <h2 className="font-semibold text-white">Email alerts</h2>
                <p className="text-sm text-text-muted">
                  Monitoring emails are sent to your account email address.
                </p>
              </div>
            </div>
            <label className="mb-4 flex cursor-pointer items-center justify-between gap-4 rounded-lg bg-bg-overlay p-4">
              <span>
                <span className="block text-sm font-medium text-white">
                  Enable monitoring emails
                </span>
                <span className="text-xs text-text-muted">
                  Receive monitor, incident, and certificate alerts by email.
                </span>
              </span>
              <Toggle
                label="Enable monitoring emails"
                checked={draft.email.enabled}
                onChange={(value) => setGroupValue("email", "enabled", value)}
              />
            </label>
            <div className="divide-y divide-border-subtle">
              {sections.map((item) => (
                <label
                  key={item.key}
                  className="flex cursor-pointer items-center justify-between gap-4 py-3"
                >
                  <span className="text-sm text-white">{item.label}</span>
                  <Toggle
                    label={`${item.label} email alerts`}
                    checked={draft.email[item.key]}
                    onChange={(value) =>
                      setGroupValue("email", item.key, value)
                    }
                  />
                </label>
              ))}
            </div>
            <label className="mt-5 block text-sm font-medium text-white">
              Email frequency
              <select
                value={draft.frequency}
                onChange={(e) =>
                  updateDraft((current) => ({
                    ...current,
                    frequency: e.target.value,
                  }))
                }
                className="mt-2 block w-full rounded-lg border border-border-subtle bg-bg-base px-3 py-2.5 text-sm text-white sm:max-w-sm"
              >
                <option value="immediate">Immediately</option>
                <option value="daily">Daily digest</option>
                <option value="weekly">Weekly digest</option>
              </select>
              <span className="mt-1 block text-xs text-text-muted">
                In-app alerts remain available as they happen. Digests are sent
                after the selected period.
              </span>
            </label>
          </Card>
          <div className="flex flex-wrap justify-end gap-3">
            <Button type="button" variant="secondary" onClick={reset}>
              <RotateCcw size={15} /> Reset
            </Button>
            <Button type="submit" disabled={submittingNotifications}>
              <Save size={15} />
              {submittingNotifications ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      )}
    </PageContainer>
  );
}
