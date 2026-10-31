import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  getPublicStatus,
  getStatusPreview,
  subscribeToStatus,
} from "../services/api/statusPages";
import { Button, Input } from "../components/ui/Primitives";
import "./status-pages.css";

const label = {
  operational: "All systems operational",
  degraded: "Degraded performance",
  partial_outage: "Partial system outage",
  major_outage: "Service disruption",
  unknown: "Status unavailable",
  maintenance: "Scheduled maintenance",
};
const colors = {
  operational: "#15803d",
  degraded: "#a16207",
  major_outage: "#b91c1c",
  unknown: "#64748b",
  maintenance: "#2563eb",
  partial_outage: "#c2410c",
};
export default function PublicStatus() {
  const { slug, id } = useParams();
  const [page, setPage] = useState(null);
  const [error, setError] = useState(false);
  const [email, setEmail] = useState("");
  const [preferences, setPreferences] = useState({
    incidents: true,
    incidentUpdates: true,
    maintenance: true,
  });
  const [subscribeMessage, setSubscribeMessage] = useState("");
  const [uptimeWindow, setUptimeWindow] = useState("90d");
  useEffect(() => {
    (id
      ? getStatusPreview(id, uptimeWindow)
      : getPublicStatus(slug, uptimeWindow)
    )
      .then((r) => {
        setPage(r.data);
        setError(false);
      })
      .catch(() => setError(true));
  }, [id, slug, uptimeWindow]);
  if (error)
    return (
      <main className="mx-auto max-w-3xl p-8">
        <h1>Status page unavailable</h1>
        <p>This status page could not be found.</p>
      </main>
    );
  if (!page)
    return <main className="mx-auto max-w-3xl p-8">Loading status…</main>;
  const isDark = page.branding?.theme === "dark";
  const panelClass = isDark
    ? "mt-6 rounded-xl border border-slate-700 bg-slate-900 p-5 text-slate-100"
    : "mt-6 rounded-xl border border-slate-200 bg-white p-5 text-slate-900";
  return (
    <main
      className={`min-h-screen px-4 py-10 ${isDark ? "status-page-dark bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900"}`}
    >
      <div className="mx-auto max-w-3xl">
        {page.isPreview && (
          <p className="mb-4 rounded-lg bg-amber-100 p-3 text-amber-950">
            Preview: only you can see this unpublished status page.
          </p>
        )}
        <header
          className="mb-6 flex items-center gap-4 border-b-4 pb-4"
          style={{ borderColor: page.branding?.accentColor || "#15803d" }}
        >
          {page.logo && (
            <img
              src={page.logo}
              alt=""
              className="h-12 w-12 rounded object-contain"
            />
          )}
          <div>
            <h1 className="text-3xl font-bold">{page.name}</h1>
            {page.description && (
              <p className="mt-1 text-slate-600">{page.description}</p>
            )}
          </div>
        </header>
        <section
          role="status"
          className="rounded-xl p-5 text-white"
          style={{ backgroundColor: colors[page.status] }}
        >
          <h2 className="text-xl font-semibold">{label[page.status]}</h2>
          <p className="mt-1 text-sm opacity-90">
            Updated {new Date(page.updatedAt).toLocaleString()}
          </p>
        </section>
        {page.incidents?.length > 0 && (
          <section className={panelClass}>
            <h2 className="mb-3 text-lg font-semibold">Incident history</h2>
            <div className="space-y-4">
              {page.incidents.map((incident, incidentIndex) => (
                <article
                  key={`${incident.title}-${incident.startedAt}-${incidentIndex}`}
                  className="border-t border-slate-100 pt-3"
                >
                  <div className="flex flex-wrap justify-between gap-2">
                    <h3 className="font-semibold">{incident.title}</h3>
                    <span className="text-sm capitalize text-slate-500">
                      {incident.severity} · {incident.status}
                    </span>
                  </div>
                  {incident.affectedServices.length > 0 && (
                    <p className="text-sm text-slate-500">
                      Affected: {incident.affectedServices.join(", ")}
                    </p>
                  )}
                  {incident.description && (
                    <p className="mt-1 text-slate-600">
                      {incident.description}
                    </p>
                  )}
                  {incident.updates.map((update, index) => (
                    <div
                      key={`${incident.startedAt}-${index}`}
                      className="mt-3 border-l-2 border-slate-200 pl-3"
                    >
                      <p>{update.message}</p>
                      <small className="text-slate-500">
                        {update.status} ·{" "}
                        {new Date(update.createdAt).toLocaleString()}
                      </small>
                    </div>
                  ))}
                </article>
              ))}
            </div>
          </section>
        )}
        {page.maintenance?.length > 0 && (
          <section className={panelClass}>
            <h2 className="mb-3 text-lg font-semibold">Maintenance</h2>
            <div className="space-y-3">
              {page.maintenance.map((item, maintenanceIndex) => (
                <article
                  key={`${item.title}-${item.scheduledStart}-${maintenanceIndex}`}
                  className="border-t border-slate-100 pt-3"
                >
                  <div className="flex flex-wrap justify-between gap-2">
                    <h3 className="font-semibold">{item.title}</h3>
                    <span className="text-sm capitalize text-slate-500">
                      {item.status.replace("_", " ")}
                    </span>
                  </div>
                  {item.affectedServices.length > 0 && (
                    <p className="text-sm text-slate-500">
                      Affected: {item.affectedServices.join(", ")}
                    </p>
                  )}
                  {item.description && (
                    <p className="mt-1 text-slate-600">{item.description}</p>
                  )}
                  <p className="mt-1 text-sm text-slate-500">
                    {new Intl.DateTimeFormat(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: page.timezone,
                    }).format(new Date(item.scheduledStart))}{" "}
                    –{" "}
                    {new Intl.DateTimeFormat(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: page.timezone,
                    }).format(new Date(item.scheduledEnd))}{" "}
                    ({page.timezone})
                  </p>
                </article>
              ))}
            </div>
          </section>
        )}
        {!page.isPreview && (
          <section className={panelClass}>
            <h2 className="text-lg font-semibold">Subscribe to updates</h2>
            <p className="mt-1 text-sm text-slate-600">
              Confirm your email to receive incident and maintenance
              notifications.
            </p>
            <form
              className="mt-4 flex flex-wrap items-end gap-3"
              onSubmit={async (event) => {
                event.preventDefault();
                setSubscribeMessage("");
                try {
                  const response = await subscribeToStatus(slug, {
                    email,
                    preferences,
                  });
                  setSubscribeMessage(response.message);
                  setEmail("");
                } catch {
                  setSubscribeMessage(
                    "Could not submit the request. Please try again later.",
                  );
                }
              }}
            >
              <div className="min-w-64 flex-1">
                <Input
                  label="Email address"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              <Button type="submit">Subscribe</Button>
            </form>
            <div className="mt-3 flex flex-wrap gap-4 text-sm">
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
            </div>
            {subscribeMessage && (
              <p role="status" className="mt-3 text-sm text-slate-600">
                {subscribeMessage}
              </p>
            )}
          </section>
        )}
        <section className={panelClass}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Services</h2>
            <label className="flex items-center gap-2 text-sm">
              Uptime window
              <select
                className="rounded border border-slate-300 px-2 py-1"
                value={uptimeWindow}
                onChange={(event) => setUptimeWindow(event.target.value)}
              >
                <option value="24h">24 hours</option>
                <option value="7d">7 days</option>
                <option value="30d">30 days</option>
                <option value="90d">90 days</option>
              </select>
            </label>
          </div>
          {page.services.length ? (
            page.services.map((s, serviceIndex) => (
              <div
                key={`${s.name}-${serviceIndex}`}
                className="flex items-center justify-between border-t border-slate-100 py-3"
              >
                <div>
                  <h3 className="font-medium">{s.name}</h3>
                  {s.description && (
                    <p className="text-sm text-slate-500">{s.description}</p>
                  )}
                </div>
                <div className="text-right">
                  <span
                    className="font-medium"
                    style={{ color: colors[s.status] }}
                  >
                    {label[s.status]}
                  </span>
                  <p className="text-sm text-slate-500">
                    {`Observed uptime (${uptimeWindow === "24h" ? "24 hours" : `${s.uptimeDays || 0} days`}): `}
                    {s.uptimePercentage == null
                      ? "N/A"
                      : `${s.uptimePercentage.toFixed(2)}%`}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-slate-500">No services have been added yet.</p>
          )}
        </section>
        <footer className="mt-5 text-right text-sm text-slate-500">
          Powered by SiteWatch
        </footer>
      </div>
    </main>
  );
}
