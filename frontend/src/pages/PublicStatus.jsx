import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getPublicStatus } from "../services/api/statusPages";

const label = {
  operational: "All systems operational",
  degraded: "Degraded performance",
  major_outage: "Service disruption",
  unknown: "Status unavailable",
};
const colors = {
  operational: "#15803d",
  degraded: "#a16207",
  major_outage: "#b91c1c",
  unknown: "#64748b",
};
export default function PublicStatus() {
  const { slug } = useParams();
  const [page, setPage] = useState(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    getPublicStatus(slug)
      .then((r) => setPage(r.data))
      .catch(() => setError(true));
  }, [slug]);
  if (error)
    return (
      <main className="mx-auto max-w-3xl p-8">
        <h1>Status page unavailable</h1>
        <p>This status page could not be found.</p>
      </main>
    );
  if (!page)
    return <main className="mx-auto max-w-3xl p-8">Loading status…</main>;
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6 flex items-center gap-4">
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
        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-lg font-semibold">Services</h2>
          {page.services.length ? (
            page.services.map((s) => (
              <div
                key={s.id}
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
                    90-day uptime:{" "}
                    {s.uptime90d == null ? "N/A" : `${s.uptime90d.toFixed(2)}%`}
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
