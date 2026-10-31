import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "../components/ui/Primitives";
import {
  getSubscriberPreferences,
  unsubscribeFromStatus,
  updateSubscriberPreferences,
  verifyStatusSubscription,
} from "../services/api/statusPages";

const DEFAULT_PREFERENCES = {
  incidents: true,
  incidentUpdates: true,
  maintenance: true,
};

export default function StatusSubscription() {
  const location = useLocation();
  const [message, setMessage] = useState("Processing your request…");
  const [preferences, setPreferences] = useState(null);
  const [saving, setSaving] = useState(false);
  const hashParams = new URLSearchParams(location.hash.slice(1));
  const token = hashParams.get("token");
  const action = hashParams.get("action");
  const invalidLink =
    !token || !["verify", "unsubscribe", "preferences"].includes(action);

  useEffect(() => {
    if (invalidLink) return;
    if (action === "preferences") {
      getSubscriberPreferences(token)
        .then((response) => {
          setPreferences({ ...DEFAULT_PREFERENCES, ...response.data });
          setMessage("");
        })
        .catch(() =>
          setMessage("This preferences link is invalid or expired."),
        );
      return;
    }
    const task =
      action === "verify" ? verifyStatusSubscription : unsubscribeFromStatus;
    task(token)
      .then(() =>
        setMessage(
          action === "verify"
            ? "Your email is confirmed. You’ll receive status updates."
            : "You have been unsubscribed from status updates.",
        ),
      )
      .catch(() => setMessage("This link is invalid or has expired."));
  }, [action, invalidLink, token]);

  const savePreferences = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await updateSubscriberPreferences(token, preferences);
      setMessage(response.message);
    } catch {
      setMessage(
        "Could not save your preferences. This link may have expired.",
      );
    } finally {
      setSaving(false);
    }
  };

  const displayedMessage = invalidLink
    ? "This subscription link is invalid."
    : message;
  return (
    <main className="min-h-screen bg-slate-50 p-8 text-slate-900">
      <div className="mx-auto max-w-xl rounded-xl border border-slate-200 bg-white p-6">
        <h1 className="text-2xl font-semibold">Status notifications</h1>
        {preferences ? (
          <form className="mt-4 space-y-4" onSubmit={savePreferences}>
            <p>Choose which updates you receive:</p>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={preferences.incidents}
                onChange={(e) =>
                  setPreferences({
                    ...preferences,
                    incidents: e.target.checked,
                  })
                }
              />{" "}
              Incidents
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={preferences.incidentUpdates}
                onChange={(e) =>
                  setPreferences({
                    ...preferences,
                    incidentUpdates: e.target.checked,
                  })
                }
              />{" "}
              Incident updates
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={preferences.maintenance}
                onChange={(e) =>
                  setPreferences({
                    ...preferences,
                    maintenance: e.target.checked,
                  })
                }
              />{" "}
              Maintenance
            </label>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save preferences"}
            </Button>
          </form>
        ) : (
          <p className="mt-3">{displayedMessage}</p>
        )}
        {message && preferences && (
          <p role="status" className="mt-3">
            {message}
          </p>
        )}
        <Link className="mt-5 inline-block underline" to="/">
          Back to SiteWatch
        </Link>
      </div>
    </main>
  );
}
