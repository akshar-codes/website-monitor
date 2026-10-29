import { useState } from "react";
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

  return null;
}
