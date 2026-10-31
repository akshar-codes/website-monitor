import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Globe2, Plus, ExternalLink, Trash2, Pencil } from "lucide-react";
import {
  Page,
  Panel,
  Button,
  Input,
  Notice,
  Select,
} from "../components/ui/Primitives";
import * as api from "../services/api/statusPages";
import { getMonitors } from "../services/api/monitors";

export default function StatusPages() {
  const [pages, setPages] = useState([]);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    description: "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    logo: "",
    branding: { theme: "light", accentColor: "#15803d" },
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [monitors, setMonitors] = useState([]);
  const [selectedMonitor, setSelectedMonitor] = useState({});
  const [usage, setUsage] = useState(null);
  const [editingPage, setEditingPage] = useState(null);
  const [editingService, setEditingService] = useState(null);
  const [success, setSuccess] = useState("");
  const [deletePage, setDeletePage] = useState(null);
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
      const loadMonitors = async () => {
        try {
          const first = await getMonitors({ limit: 100 });
          const rest = await Promise.all(
            Array.from(
              { length: Math.max(0, (first.pagination?.totalPages || 1) - 1) },
              (_, index) => getMonitors({ limit: 100, page: index + 2 }),
            ),
          );
          setMonitors([
            ...(first.data || []),
            ...rest.flatMap((result) => result.data || []),
          ]);
        } catch {
          setMonitors([]);
        }
      };
      loadMonitors();
      api
        .getUsage()
        .then((r) => setUsage(r.data?.statusPages || null))
        .catch(() => {});
    }, 0);
    return () => clearTimeout(timer);
  }, [refresh]);
  const submit = async (event) => {
    event.preventDefault();
    setError("");
    try {
      await api.createStatusPage(form);
      setForm({
        name: "",
        slug: "",
        description: "",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        logo: "",
        branding: { theme: "light", accentColor: "#15803d" },
      });
      await refresh();
    } catch (e) {
      setError(e.response?.data?.message || "Could not create status page");
    }
  };
  const act = async (fn) => {
    setError("");
    setSuccess("");
    try {
      await fn();
      await refresh();
      setSuccess("Status page changes saved.");
    } catch (e) {
      setError(e.response?.data?.message || "Action failed");
    }
  };
  return (
    <Page
      title="Status pages"
      description="Publish a public view of your monitored services."
      actions={
        <Link to="#create-status-page">
          <Button>
            <Plus size={16} /> Create page
          </Button>
        </Link>
      }
    >
      {error && <Notice tone="error">{error}</Notice>}
      {success && <Notice tone="success">{success}</Notice>}
      {usage && (
        <p className="mb-4 text-sm text-slate-600">
          Plan usage: {usage.used} / {usage.limit} status pages · up to{" "}
          {usage.servicesPerPageLimit} services per page ·{" "}
          {usage.subscribersPerPageLimit} subscribers per page.
        </p>
      )}
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
                    /status/{page.slug} · {page.services?.length || 0}/
                    {usage?.servicesPerPageLimit ?? "∞"} services ·{" "}
                    {usage?.pages?.find((item) => item.id === page.id)
                      ?.subscribers || 0}
                    /{usage?.subscribersPerPageLimit ?? "∞"} subscribers ·{" "}
                    {page.isPublished ? "Published" : "Unpublished"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link
                    className="sw-button secondary"
                    to={`/status-pages/${page.id}/manage`}
                  >
                    Manage updates
                  </Link>
                  <Link
                    className="sw-button secondary"
                    to={`/status-preview/${page.id}`}
                    target="_blank"
                  >
                    Preview
                  </Link>
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
                    onClick={() =>
                      setEditingPage(
                        editingPage?.id === page.id
                          ? null
                          : {
                              id: page.id,
                              name: page.name,
                              slug: page.slug,
                              description: page.description || "",
                              timezone: page.timezone || "UTC",
                              logo: page.logo || "",
                              branding: {
                                theme: page.branding?.theme || "light",
                                accentColor:
                                  page.branding?.accentColor || "#15803d",
                              },
                            },
                      )
                    }
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
                    onClick={() => setDeletePage(page)}
                    aria-label={`Delete ${page.name}`}
                  >
                    <Trash2 size={15} />
                  </Button>
                </div>
                {deletePage?.id === page.id && (
                  <div
                    role="alertdialog"
                    aria-label={`Delete ${page.name}`}
                    className="w-full rounded-lg border border-red-200 bg-red-50 p-4"
                  >
                    <p className="font-medium">
                      Delete “{page.name}” and its status page history?
                    </p>
                    <p className="mt-1 text-sm">
                      This removes its incidents, maintenance records, and
                      subscribers. Monitors remain unchanged.
                    </p>
                    <div className="mt-3 flex gap-2">
                      <Button
                        type="button"
                        onClick={() =>
                          act(async () => {
                            await api.deleteStatusPage(page.id);
                            setDeletePage(null);
                          })
                        }
                      >
                        Delete status page
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setDeletePage(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
                {editingPage?.id === page.id && (
                  <form
                    className="grid w-full gap-3 border-t border-slate-100 pt-4 md:grid-cols-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      act(async () => {
                        await api.updateStatusPage(page.id, {
                          ...editingPage,
                          slug: editingPage.slug
                            .toLowerCase()
                            .trim()
                            .replace(/\s+/g, "-"),
                        });
                        setEditingPage(null);
                      });
                    }}
                  >
                    <Input
                      label="Page name"
                      required
                      maxLength={120}
                      value={editingPage.name}
                      onChange={(e) =>
                        setEditingPage({ ...editingPage, name: e.target.value })
                      }
                    />
                    <Input
                      label="URL slug"
                      required
                      minLength={3}
                      maxLength={60}
                      pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                      value={editingPage.slug}
                      onChange={(e) =>
                        setEditingPage({ ...editingPage, slug: e.target.value })
                      }
                    />
                    <Input
                      label="Description"
                      maxLength={500}
                      value={editingPage.description}
                      onChange={(e) =>
                        setEditingPage({
                          ...editingPage,
                          description: e.target.value,
                        })
                      }
                    />
                    <Input
                      label="Timezone"
                      required
                      value={editingPage.timezone}
                      onChange={(e) =>
                        setEditingPage({
                          ...editingPage,
                          timezone: e.target.value,
                        })
                      }
                    />
                    <Input
                      label="Logo URL"
                      type="url"
                      value={editingPage.logo}
                      onChange={(e) =>
                        setEditingPage({ ...editingPage, logo: e.target.value })
                      }
                    />
                    <Select
                      label="Theme"
                      value={editingPage.branding.theme}
                      onChange={(e) =>
                        setEditingPage({
                          ...editingPage,
                          branding: {
                            ...editingPage.branding,
                            theme: e.target.value,
                          },
                        })
                      }
                    >
                      <option value="light">Light</option>
                      <option value="dark">Dark</option>
                    </Select>
                    <Input
                      label="Accent color"
                      type="color"
                      value={editingPage.branding.accentColor}
                      onChange={(e) =>
                        setEditingPage({
                          ...editingPage,
                          branding: {
                            ...editingPage.branding,
                            accentColor: e.target.value,
                          },
                        })
                      }
                    />
                    <div className="flex gap-2">
                      <Button type="submit">Save changes</Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setEditingPage(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                )}
                <div className="flex w-full flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                  {[...(page.services || [])]
                    .sort((a, b) => a.displayOrder - b.displayOrder)
                    .map((service, serviceIndex, orderedServices) => (
                      <span
                        key={service.id}
                        className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-sm"
                      >
                        <span
                          className={
                            service.isVisible
                              ? ""
                              : "line-through text-slate-400"
                          }
                        >
                          {service.displayName}
                        </span>
                        <button
                          type="button"
                          className="ml-1 text-slate-500"
                          title="Edit public service details"
                          aria-label={`Edit ${service.displayName}`}
                          onClick={() =>
                            setEditingService(
                              editingService?.id === service.id
                                ? null
                                : {
                                    id: service.id,
                                    pageId: page.id,
                                    displayName: service.displayName,
                                    description: service.description || "",
                                  },
                            )
                          }
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          type="button"
                          className="text-slate-500"
                          title={
                            service.isVisible
                              ? "Hide from public page"
                              : "Show on public page"
                          }
                          onClick={() =>
                            act(() =>
                              api.updateStatusService(page.id, service.id, {
                                isVisible: !service.isVisible,
                              }),
                            )
                          }
                        >
                          {service.isVisible ? "Hide" : "Show"}
                        </button>
                        <button
                          type="button"
                          className="text-slate-500"
                          title="Move up"
                          disabled={serviceIndex === 0}
                          onClick={() => {
                            const reordered = [...orderedServices];
                            [
                              reordered[serviceIndex - 1],
                              reordered[serviceIndex],
                            ] = [
                              reordered[serviceIndex],
                              reordered[serviceIndex - 1],
                            ];
                            act(() =>
                              api.reorderStatusServices(
                                page.id,
                                reordered.map((item) => item.id),
                              ),
                            );
                          }}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="text-slate-500"
                          title="Move down"
                          disabled={serviceIndex === orderedServices.length - 1}
                          onClick={() => {
                            const reordered = [...orderedServices];
                            [
                              reordered[serviceIndex + 1],
                              reordered[serviceIndex],
                            ] = [
                              reordered[serviceIndex],
                              reordered[serviceIndex + 1],
                            ];
                            act(() =>
                              api.reorderStatusServices(
                                page.id,
                                reordered.map((item) => item.id),
                              ),
                            );
                          }}
                        >
                          ↓
                        </button>
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
                  {editingService?.pageId === page.id && (
                    <form
                      className="grid w-full gap-3 rounded border p-3 md:grid-cols-2"
                      onSubmit={(event) => {
                        event.preventDefault();
                        act(async () => {
                          await api.updateStatusService(
                            page.id,
                            editingService.id,
                            {
                              displayName: editingService.displayName,
                              description: editingService.description,
                            },
                          );
                          setEditingService(null);
                        });
                      }}
                    >
                      <Input
                        label="Public service name"
                        required
                        maxLength={120}
                        value={editingService.displayName}
                        onChange={(e) =>
                          setEditingService({
                            ...editingService,
                            displayName: e.target.value,
                          })
                        }
                      />
                      <Input
                        label="Public description"
                        maxLength={500}
                        value={editingService.description}
                        onChange={(e) =>
                          setEditingService({
                            ...editingService,
                            description: e.target.value,
                          })
                        }
                      />
                      <div className="flex gap-2">
                        <Button type="submit">Save service</Button>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => setEditingService(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </form>
                  )}
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
      <Panel title="Create a page" className="mt-5" id="create-status-page">
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
          <Input
            label="Logo URL (optional)"
            type="url"
            value={form.logo}
            onChange={(e) => setForm({ ...form, logo: e.target.value })}
          />
          <Input
            label="Display timezone (IANA)"
            value={form.timezone}
            maxLength={80}
            required
            onChange={(e) => setForm({ ...form, timezone: e.target.value })}
          />
          <Select
            label="Public theme"
            value={form.branding.theme}
            onChange={(e) =>
              setForm({
                ...form,
                branding: { ...form.branding, theme: e.target.value },
              })
            }
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </Select>
          <Input
            label="Brand accent color"
            type="color"
            value={form.branding.accentColor}
            onChange={(e) =>
              setForm({
                ...form,
                branding: { ...form.branding, accentColor: e.target.value },
              })
            }
          />
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
