import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Globe2, Plus, ExternalLink, Trash2, Pencil } from "lucide-react";
import {
  Page,
  Panel,
  Button,
  Input,
  Notice,
} from "../components/ui/Primitives";
import * as api from "../services/api/statusPages";
import { getMonitors } from "../services/api/monitors";

export default function StatusPages() {
  const [pages, setPages] = useState([]);
  const [form, setForm] = useState({ name: "", slug: "", description: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [monitors, setMonitors] = useState([]);
  const [selectedMonitor, setSelectedMonitor] = useState({});
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setPages((await api.listStatusPages()).data || []);
    } catch (e) {
      setError(e.response?.data?.message || "Could not load status pages");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => {
      refresh();
      getMonitors({ limit: 100 })
        .then((r) => setMonitors(r.data || []))
        .catch(() => {});
    }, 0);
    return () => clearTimeout(timer);
  }, [refresh]);
  const submit = async (event) => {
    event.preventDefault();
    setError("");
    try {
      await api.createStatusPage(form);
      setForm({ name: "", slug: "", description: "" });
      await refresh();
    } catch (e) {
      setError(e.response?.data?.message || "Could not create status page");
    }
  };
  const act = async (fn) => {
    setError("");
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(e.response?.data?.message || "Action failed");
    }
  };
  return (
    <Page
      title="Status pages"
      description="Publish a public view of your monitored services."
      actions={
        <Link to="/status-pages/new">
          <Button>
            <Plus size={16} /> Create page
          </Button>
        </Link>
      }
    >
      {error && <Notice variant="error">{error}</Notice>}
      <Panel
        title="Your status pages"
        subtitle="Visitors only see the services and uptime shown on the public page."
      >
        {loading ? (
          <p>Loading…</p>
        ) : pages.length ? (
          <div className="space-y-3">
            {pages.map((page) => (
              <div
                key={page.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4"
              >
                <div>
                  <h3 className="font-semibold">{page.name}</h3>
                  <p className="text-sm text-slate-500">
                    /status/{page.slug} · {page.services?.length || 0} services
                    · {page.isPublished ? "Published" : "Unpublished"}
                  </p>
                </div>
                <div className="flex gap-2">
                  {page.isPublished && (
                    <a
                      className="sw-button secondary"
                      href={`/status/${page.slug}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ExternalLink size={15} /> View
                    </a>
                  )}
                  <Button
                    variant="secondary"
                    onClick={() => {
                      const name = window.prompt("Page name", page.name);
                      if (name === null) return;
                      const slug = window.prompt("Public URL slug", page.slug);
                      if (slug === null) return;
                      act(() =>
                        api.updateStatusPage(page.id, {
                          name,
                          slug: slug.toLowerCase().trim().replace(/\s+/g, "-"),
                        }),
                      );
                    }}
                  >
                    <Pencil size={15} /> Edit
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      act(() =>
                        page.isPublished
                          ? api.unpublishStatusPage(page.id)
                          : api.publishStatusPage(page.id),
                      )
                    }
                  >
                    {page.isPublished ? "Unpublish" : "Publish"}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      if (window.confirm(`Delete ${page.name}?`))
                        act(() => api.deleteStatusPage(page.id));
                    }}
                    aria-label={`Delete ${page.name}`}
                  >
                    <Trash2 size={15} />
                  </Button>
                </div>
                <div className="flex w-full flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                  {page.services?.map((service) => (
                    <span
                      key={service.id}
                      className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-sm"
                    >
                      {service.displayName}
                      <button
                        type="button"
                        className="ml-1 text-slate-500"
                        aria-label={`Remove ${service.displayName}`}
                        onClick={() =>
                          act(() =>
                            api.removeStatusService(page.id, service.id),
                          )
                        }
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <select
                    aria-label={`Select monitor for ${page.name}`}
                    className="rounded border border-slate-300 px-2 py-1"
                    value={selectedMonitor[page.id] || ""}
                    onChange={(e) =>
                      setSelectedMonitor({
                        ...selectedMonitor,
                        [page.id]: e.target.value,
                      })
                    }
                  >
                    <option value="">Add a monitor…</option>
                    {monitors
                      .filter(
                        (monitor) =>
                          !(page.services || []).some(
                            (service) =>
                              String(
                                service.monitor?._id || service.monitor,
                              ) === String(monitor.id || monitor._id),
                          ),
                      )
                      .map((monitor) => (
                        <option
                          key={monitor.id || monitor._id}
                          value={monitor.id || monitor._id}
                        >
                          {monitor.name}
                        </option>
                      ))}
                  </select>
                  <Button
                    variant="secondary"
                    disabled={!selectedMonitor[page.id]}
                    onClick={() =>
                      act(async () => {
                        await api.addStatusService(page.id, {
                          monitorId: selectedMonitor[page.id],
                        });
                        setSelectedMonitor({
                          ...selectedMonitor,
                          [page.id]: "",
                        });
                      })
                    }
                  >
                    Add service
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p>No status pages yet.</p>
        )}
      </Panel>
      <Panel title="Create a page" className="mt-5">
        <form className="grid gap-4 md:grid-cols-2" onSubmit={submit}>
          <Input
            label="Page name"
            value={form.name}
            maxLength={120}
            required
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Input
            label="Public URL slug"
            value={form.slug}
            maxLength={60}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            required
            onChange={(e) =>
              setForm({
                ...form,
                slug: e.target.value.toLowerCase().replace(/\s+/g, "-"),
              })
            }
          />
          <div className="md:col-span-2">
            <Input
              label="Description (optional)"
              value={form.description}
              maxLength={500}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </div>
          <div>
            <Button type="submit">
              <Globe2 size={16} /> Create status page
            </Button>
          </div>
        </form>
      </Panel>
    </Page>
  );
}
