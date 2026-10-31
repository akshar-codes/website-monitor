import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Page,
  Panel,
  Button,
  Input,
  Notice,
  Select,
} from "../components/ui/Primitives";
import * as api from "../services/api/statusPages";

const initialIncident = {
  title: "",
  description: "",
  severity: "minor",
  affectedServices: [],
};
const initialMaintenance = {
  title: "",
  description: "",
  scheduledStart: "",
  scheduledEnd: "",
  affectedServices: [],
};
export default function StatusPageManage() {
  const { id } = useParams();
  const [page, setPage] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [subscriberStats, setSubscriberStats] = useState(null);
  const [incident, setIncident] = useState(initialIncident);
  const [windowForm, setWindowForm] = useState(initialMaintenance);
  const [messages, setMessages] = useState({});
  const [updateStatuses, setUpdateStatuses] = useState({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingIncident, setEditingIncident] = useState(null);
  const [editingMaintenance, setEditingMaintenance] = useState(null);
  const refresh = useCallback(async () => {
    try {
      const [p, i, m, s] = await Promise.all([
        api.getStatusPage(id),
        api.getStatusIncidents(id),
        api.getStatusMaintenance(id),
        api.getStatusSubscriberStats(id),
      ]);
      setPage(p.data);
      setIncidents(i.data || []);
      setMaintenance(m.data || []);
      setSubscriberStats(s.data);
    } catch (e) {
      setError(
        e.response?.data?.message || "Could not load status page details",
      );
    }
  }, [id]);
  useEffect(() => {
    const timer = setTimeout(refresh, 0);
    return () => clearTimeout(timer);
  }, [refresh]);
  const act = async (task) => {
    setError("");
    setSuccess("");
    try {
      await task();
      await refresh();
      setSuccess("Changes saved.");
    } catch (e) {
      setError(e.response?.data?.message || "Action failed");
    }
  };
  const checkbox = (selected, setSelected, serviceId) => (
    <input
      type="checkbox"
      checked={selected.includes(serviceId)}
      onChange={(e) =>
        setSelected(
          e.target.checked
            ? [...selected, serviceId]
            : selected.filter((item) => item !== serviceId),
        )
      }
    />
  );
  const servicePicker = (selected, setSelected) => (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-sm font-medium">Affected services</legend>
      {(page?.services || []).map((service) => (
        <label key={service.id} className="flex items-center gap-2 text-sm">
          {checkbox(selected, setSelected, service.id)}
          {service.displayName}
        </label>
      ))}
    </fieldset>
  );
  if (!page)
    return (
      <Page title="Status page management">
        {error ? <Notice tone="error">{error}</Notice> : <p>Loading…</p>}
      </Page>
    );
  return (
    <Page
      title={page.name}
      description={`Manage incidents, maintenance, and subscriber totals for /status/${page.slug}`}
      actions={
        <Link to="/status-pages">
          <Button variant="secondary">Back to status pages</Button>
        </Link>
      }
    >
      {error && <Notice tone="error">{error}</Notice>}
      {success && <Notice tone="success">{success}</Notice>}
      <Panel
        title="Subscriber totals"
        subtitle="Email addresses are private and are not listed in the dashboard."
      >
        <p>
          {subscriberStats?.active || 0} verified subscribers ·{" "}
          {subscriberStats?.pending || 0} awaiting verification · limit{" "}
          {subscriberStats?.limit}
        </p>
      </Panel>
      <Panel title="Report an incident" className="mt-5">
        <form
          className="grid gap-4 md:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            act(async () => {
              await api.createStatusIncident(id, incident);
              setIncident(initialIncident);
            });
          }}
        >
          <Input
            label="Incident title"
            required
            maxLength={160}
            value={incident.title}
            onChange={(e) =>
              setIncident({ ...incident, title: e.target.value })
            }
          />
          <Select
            label="Severity"
            value={incident.severity}
            onChange={(e) =>
              setIncident({ ...incident, severity: e.target.value })
            }
          >
            <option value="minor">Minor</option>
            <option value="major">Major</option>
            <option value="critical">Critical</option>
          </Select>
          <div className="md:col-span-2">
            <Input
              label="Public description"
              maxLength={3000}
              value={incident.description}
              onChange={(e) =>
                setIncident({ ...incident, description: e.target.value })
              }
            />
          </div>
          <div className="md:col-span-2">
            {servicePicker(incident.affectedServices, (affectedServices) =>
              setIncident({ ...incident, affectedServices }),
            )}
          </div>
          <div>
            <Button type="submit">Create incident</Button>
          </div>
        </form>
        <div className="mt-5 space-y-4">
          {incidents.map((item) => (
            <article
              key={item._id}
              className="rounded-lg border border-slate-200 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-semibold">{item.title}</h3>
                  <p className="text-sm text-slate-500">
                    {item.severity} · {item.status} ·{" "}
                    {item.isPublished ? "Published" : "Draft"}
                  </p>
                </div>
                <div className="flex gap-2">
                  {item.status !== "resolved" && (
                    <Button
                      variant="secondary"
                      onClick={() =>
                        setEditingIncident(
                          editingIncident?.id === item._id
                            ? null
                            : {
                                id: item._id,
                                title: item.title,
                                description: item.description || "",
                                severity: item.severity,
                              },
                        )
                      }
                    >
                      Edit
                    </Button>
                  )}
                  {!item.isPublished && (
                    <Button
                      variant="secondary"
                      onClick={() =>
                        act(() => api.publishStatusIncident(id, item._id))
                      }
                    >
                      Publish
                    </Button>
                  )}
                  {item.status !== "resolved" && (
                    <Button
                      variant="secondary"
                      onClick={() =>
                        act(() =>
                          api.resolveStatusIncident(id, item._id, {
                            message: "The incident has been resolved.",
                          }),
                        )
                      }
                    >
                      Resolve
                    </Button>
                  )}
                </div>
              </div>
              {editingIncident?.id === item._id && (
                <form
                  className="mt-4 grid gap-3 rounded border p-3 md:grid-cols-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    act(async () => {
                      await api.updateStatusIncident(id, item._id, {
                        title: editingIncident.title,
                        description: editingIncident.description,
                        severity: editingIncident.severity,
                      });
                      setEditingIncident(null);
                    });
                  }}
                >
                  <Input
                    label="Incident title"
                    required
                    maxLength={160}
                    value={editingIncident.title}
                    onChange={(e) =>
                      setEditingIncident({
                        ...editingIncident,
                        title: e.target.value,
                      })
                    }
                  />
                  <Select
                    label="Severity"
                    value={editingIncident.severity}
                    onChange={(e) =>
                      setEditingIncident({
                        ...editingIncident,
                        severity: e.target.value,
                      })
                    }
                  >
                    <option value="minor">Minor</option>
                    <option value="major">Major</option>
                    <option value="critical">Critical</option>
                  </Select>
                  <Input
                    label="Public description"
                    maxLength={3000}
                    value={editingIncident.description}
                    onChange={(e) =>
                      setEditingIncident({
                        ...editingIncident,
                        description: e.target.value,
                      })
                    }
                  />
                  <div className="flex gap-2">
                    <Button type="submit">Save incident</Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setEditingIncident(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              )}
              {item.updates?.map((update) => (
                <div
                  key={update._id}
                  className="mt-3 border-l-2 border-slate-200 pl-3"
                >
                  <p>{update.message}</p>
                  <small className="text-slate-500">
                    {update.status} ·{" "}
                    {new Date(update.createdAt).toLocaleString()}
                  </small>
                </div>
              ))}
              {item.status !== "resolved" && (
                <form
                  className="mt-4 flex flex-wrap gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const message = messages[item._id];
                    if (!message) return;
                    act(async () => {
                      await api.addStatusIncidentUpdate(id, item._id, {
                        message,
                        status: updateStatuses[item._id] || item.status,
                      });
                      setMessages({ ...messages, [item._id]: "" });
                    });
                  }}
                >
                  <Input
                    aria-label="Incident update"
                    placeholder="Post a public update"
                    value={messages[item._id] || ""}
                    onChange={(e) =>
                      setMessages({ ...messages, [item._id]: e.target.value })
                    }
                  />
                  <select
                    aria-label="Incident lifecycle status"
                    className="rounded border border-slate-300 px-2 py-1"
                    value={updateStatuses[item._id] || item.status}
                    onChange={(e) =>
                      setUpdateStatuses({
                        ...updateStatuses,
                        [item._id]: e.target.value,
                      })
                    }
                  >
                    {(
                      {
                        investigating: [
                          "investigating",
                          "identified",
                          "monitoring",
                        ],
                        identified: ["identified", "monitoring"],
                        monitoring: ["monitoring", "investigating"],
                      }[item.status] || []
                    ).map((state) => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </select>
                  <Button type="submit" variant="secondary">
                    Post update
                  </Button>
                </form>
              )}
            </article>
          ))}
        </div>
      </Panel>
      <Panel title="Schedule maintenance" className="mt-5">
        <form
          className="grid gap-4 md:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            act(async () => {
              await api.createStatusMaintenance(id, {
                ...windowForm,
                scheduledStart: new Date(
                  windowForm.scheduledStart,
                ).toISOString(),
                scheduledEnd: new Date(windowForm.scheduledEnd).toISOString(),
              });
              setWindowForm(initialMaintenance);
            });
          }}
        >
          <Input
            label="Maintenance title"
            required
            value={windowForm.title}
            onChange={(e) =>
              setWindowForm({ ...windowForm, title: e.target.value })
            }
          />
          <Input
            label="Description"
            value={windowForm.description}
            onChange={(e) =>
              setWindowForm({ ...windowForm, description: e.target.value })
            }
          />
          <Input
            label="Start (local time)"
            type="datetime-local"
            required
            value={windowForm.scheduledStart}
            onChange={(e) =>
              setWindowForm({ ...windowForm, scheduledStart: e.target.value })
            }
          />
          <Input
            label="End (local time)"
            type="datetime-local"
            required
            value={windowForm.scheduledEnd}
            onChange={(e) =>
              setWindowForm({ ...windowForm, scheduledEnd: e.target.value })
            }
          />
          <div className="md:col-span-2">
            {servicePicker(windowForm.affectedServices, (affectedServices) =>
              setWindowForm({ ...windowForm, affectedServices }),
            )}
            <p className="mt-1 text-xs text-slate-500">
              Times use your browser’s local timezone and are stored in UTC.
              Visitors see them in {page.timezone}.
            </p>
          </div>
          <div>
            <Button type="submit">Schedule</Button>
          </div>
        </form>
        <div className="mt-5 space-y-3">
          {maintenance.map((item) => (
            <article
              key={item._id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-4"
            >
              <div>
                <h3 className="font-semibold">{item.title}</h3>
                <p className="text-sm text-slate-500">
                  {item.status} ·{" "}
                  {new Date(item.scheduledStart).toLocaleString()} –{" "}
                  {new Date(item.scheduledEnd).toLocaleString()}
                </p>
              </div>
              <div className="flex gap-2">
                {item.status === "scheduled" && (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      const local = (value) => {
                        const date = new Date(value);
                        return new Date(
                          date.getTime() - date.getTimezoneOffset() * 60000,
                        )
                          .toISOString()
                          .slice(0, 16);
                      };
                      setEditingMaintenance(
                        editingMaintenance?.id === item._id
                          ? null
                          : {
                              id: item._id,
                              title: item.title,
                              description: item.description || "",
                              scheduledStart: local(item.scheduledStart),
                              scheduledEnd: local(item.scheduledEnd),
                            },
                      );
                    }}
                  >
                    Edit
                  </Button>
                )}
                {item.status === "scheduled" && (
                  <Button
                    variant="secondary"
                    onClick={() =>
                      act(() =>
                        api.updateStatusMaintenance(id, item._id, {
                          status: "in_progress",
                        }),
                      )
                    }
                  >
                    Start
                  </Button>
                )}
                {item.status === "in_progress" && (
                  <Button
                    variant="secondary"
                    onClick={() =>
                      act(() =>
                        api.updateStatusMaintenance(id, item._id, {
                          status: "completed",
                        }),
                      )
                    }
                  >
                    Complete
                  </Button>
                )}
                {["scheduled", "in_progress"].includes(item.status) && (
                  <Button
                    variant="secondary"
                    onClick={() =>
                      act(() =>
                        api.updateStatusMaintenance(id, item._id, {
                          status: "cancelled",
                        }),
                      )
                    }
                  >
                    Cancel
                  </Button>
                )}
                {item.status === "cancelled" && (
                  <Button
                    variant="secondary"
                    onClick={() =>
                      act(() => api.deleteStatusMaintenance(id, item._id))
                    }
                  >
                    Delete
                  </Button>
                )}
              </div>
              {editingMaintenance?.id === item._id && (
                <form
                  className="grid w-full gap-3 rounded border p-3 md:grid-cols-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (
                      new Date(editingMaintenance.scheduledEnd) <=
                      new Date(editingMaintenance.scheduledStart)
                    ) {
                      setError("Maintenance end must be after its start.");
                      return;
                    }
                    act(async () => {
                      await api.updateStatusMaintenance(id, item._id, {
                        title: editingMaintenance.title,
                        description: editingMaintenance.description,
                        scheduledStart: new Date(
                          editingMaintenance.scheduledStart,
                        ).toISOString(),
                        scheduledEnd: new Date(
                          editingMaintenance.scheduledEnd,
                        ).toISOString(),
                      });
                      setEditingMaintenance(null);
                    });
                  }}
                >
                  <Input
                    label="Maintenance title"
                    required
                    maxLength={160}
                    value={editingMaintenance.title}
                    onChange={(e) =>
                      setEditingMaintenance({
                        ...editingMaintenance,
                        title: e.target.value,
                      })
                    }
                  />
                  <Input
                    label="Description"
                    maxLength={3000}
                    value={editingMaintenance.description}
                    onChange={(e) =>
                      setEditingMaintenance({
                        ...editingMaintenance,
                        description: e.target.value,
                      })
                    }
                  />
                  <Input
                    label="Start (local time)"
                    type="datetime-local"
                    required
                    value={editingMaintenance.scheduledStart}
                    onChange={(e) =>
                      setEditingMaintenance({
                        ...editingMaintenance,
                        scheduledStart: e.target.value,
                      })
                    }
                  />
                  <Input
                    label="End (local time)"
                    type="datetime-local"
                    required
                    min={editingMaintenance.scheduledStart}
                    value={editingMaintenance.scheduledEnd}
                    onChange={(e) =>
                      setEditingMaintenance({
                        ...editingMaintenance,
                        scheduledEnd: e.target.value,
                      })
                    }
                  />
                  <div className="flex gap-2">
                    <Button type="submit">Save schedule</Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setEditingMaintenance(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              )}
            </article>
          ))}
        </div>
      </Panel>
    </Page>
  );
}
