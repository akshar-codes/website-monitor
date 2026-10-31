import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useMonitorList, useMonitorMutations } from "../hooks/useMonitors";
import { useUsage } from "../hooks/useUsage";
import { useQuery } from "../hooks/useQuery";
import * as dashboardApi from "../services/api/dashboard";
import {
  isUpgradeRequiredError,
  getAccessErrorMessage,
} from "../utils/accessErrors";
import {
  Page,
  Panel,
  Button,
  Input,
  Select,
  Status,
  Notice,
} from "../components/ui/Primitives";
import {
  Globe2,
  Gauge,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Pause,
  Play,
  Copy,
  Pencil,
} from "lucide-react";
import { formatUptime } from "../utils/format";

const STATUS_FILTERS = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Paused", value: "paused" },
];

const COLUMN_HEADERS = [
  { label: "Monitor" },
  { label: "Status" },
  { label: "Uptime" },
  { label: "Response" },
  { label: "Interval" },
  { label: "Last check" },
  { label: "" },
];

function useMonitorsWithStats(monitors = []) {
  const ids = monitors.map((m) => m.id || m._id).join(",");
  return useQuery(
    async () => {
      if (!monitors.length) return {};
      const results = await Promise.allSettled(
        monitors.map((m) =>
          dashboardApi.getMonitorStats(m.id || m._id, { window: "24h" }),
        ),
      );
      const map = {};
      monitors.forEach((m, i) => {
        if (results[i].status === "fulfilled") {
          const stats = results[i].value.data;
          map[m.id || m._id] = {
            status: stats.currentStatus,
            uptimePercentage: stats.uptime?.percentage ?? null,
            avgResponseTime: stats.responseTime?.average ?? null,
          };
        }
      });
      return map;
    },
    [ids],
    { immediate: monitors.length > 0 },
  );
}

export default function Monitors() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editMonitor, setEditMonitor] = useState(null);
  const [duplicateSource, setDuplicateSource] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [limitMessage, setLimitMessage] = useState("");

  const listParams = useMemo(() => {
    const params = { page, limit: 20 };
    if (statusFilter === "active") params.active = "true";
    if (statusFilter === "paused") params.active = "false";
    return params;
  }, [page, statusFilter]);

  const { data: monitorsData, loading, refetch } = useMonitorList(listParams);
  const monitors = useMemo(() => monitorsData?.data || [], [monitorsData]);
  const pagination = monitorsData?.pagination;

  const {
    data: usageData,
    loading: usageLoading,
    refetch: refetchUsage,
  } = useUsage();
  const usage = usageData?.data;

  // statsMap initializes as null from useQuery; guard with ?? {} so map access
  // never throws regardless of fetch state (null default only catches undefined).
  const { data: statsMapRaw } = useMonitorsWithStats(monitors);
  const statsMap = statsMapRaw ?? {};

  const handleMutationSuccess = useCallback(() => {
    setFormOpen(false);
    setEditMonitor(null);
    setDuplicateSource(null);
    setDeleteTarget(null);
    setLimitMessage("");
    refetch();
    refetchUsage();
  }, [refetch, refetchUsage]);

  const handleMutationError = useCallback((err) => {
    if (isUpgradeRequiredError(err)) {
      setFormOpen(false);
      setLimitMessage(getAccessErrorMessage(err));
    }
  }, []);

  const {
    createMonitor,
    updateMonitor,
    deleteMonitor,
    toggleMonitor,
    duplicateMonitor,
    submitting,
  } = useMonitorMutations(handleMutationSuccess, handleMutationError);

  const filteredMonitors = useMemo(() => {
    if (!search.trim()) return monitors;
    const q = search.toLowerCase();
    return monitors.filter(
      (m) =>
        m.name.toLowerCase().includes(q) || m.url.toLowerCase().includes(q),
    );
  }, [monitors, search]);

  const handleFormSubmit = (data) => {
    if (duplicateSource) {
      duplicateMonitor(duplicateSource.id || duplicateSource._id, data);
    } else if (editMonitor) {
      updateMonitor(editMonitor.id || editMonitor._id, data);
    } else {
      createMonitor(data);
    }
  };

  const openEdit = (monitor) => {
    setEditMonitor(monitor);
    setLimitMessage("");
    setFormOpen(true);
  };

  const openCreate = () => {
    // Preemptive client-side check — the backend re-validates this on
    // submit regardless, but checking here avoids opening a form the
    // user can't actually submit.
    if (usage && !usage.monitors.unlimited && usage.monitors.atLimit) {
      setLimitMessage(
        `You've used all ${usage.monitors.limit} monitors on your ${usage.planName} plan. Upgrade to add more.`,
      );
      return;
    }
    setEditMonitor(null);
    setLimitMessage("");
    setFormOpen(true);
  };

  const remaining = usage?.monitors?.remaining;
  return (
    <Page
      title="Monitors"
      description="Manage checks for the websites and services you rely on."
      actions={
        <>
          <Button variant="secondary" onClick={refetch}>
            <RefreshCw size={14} /> Refresh
          </Button>
          <Button onClick={openCreate}>
            <Plus size={15} /> Add monitor
          </Button>
        </>
      }
    >
      <div className="sw-metric-grid">
        <div className="sw-metric">
          <span className="sw-metric-icon">
            <Globe2 size={17} />
          </span>
          <span className="sw-metric-label">Monitors</span>
          <strong>
            {usageLoading
              ? "—"
              : (usage?.monitors?.used ??
                monitorsData?.pagination?.total ??
                monitors.length)}
          </strong>
          <small>
            {remaining == null
              ? "Current plan usage"
              : `${remaining} slots remaining`}
          </small>
        </div>
        <div className="sw-metric">
          <span className="sw-metric-icon">●</span>
          <span className="sw-metric-label">Active checks</span>
          <strong>{monitors.filter((m) => m.active).length}</strong>
          <small>Checking on schedule</small>
        </div>
        <div className="sw-metric">
          <span className="sw-metric-icon red">!</span>
          <span className="sw-metric-label">Paused</span>
          <strong>{monitors.filter((m) => !m.active).length}</strong>
          <small>Can be resumed any time</small>
        </div>
        <div className="sw-metric">
          <span className="sw-metric-icon blue">
            <Gauge size={17} />
          </span>
          <span className="sw-metric-label">Plan</span>
          <strong className="plan-metric">{usage?.planName || "Active"}</strong>
          <small>Monitor capacity</small>
        </div>
      </div>
      {limitMessage && (
        <Notice tone="warning">
          {limitMessage} <a href="/billing">View plans</a>
        </Notice>
      )}
      <Panel
        title="All monitors"
        subtitle="Search, filter, and manage your health checks"
        actions={
          <label className="inline-search">
            <Search size={14} />
            <input
              placeholder="Search monitors"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        }
      >
        <div className="filter-pills">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.value}
              className={statusFilter === filter.value ? "active" : ""}
              onClick={() => {
                setStatusFilter(filter.value);
                setPage(1);
              }}
            >
              {filter.label}
            </button>
          ))}
        </div>
        {loading ? (
          <div className="sw-loading">Loading monitors…</div>
        ) : (
          <div className="sw-table-wrap">
            <table className="sw-table">
              <thead>
                <tr>
                  {COLUMN_HEADERS.map((col, i) => (
                    <th key={i}>{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredMonitors.map((m) => {
                  const id = m.id || m._id;
                  const stats = statsMap[id];
                  return (
                    <tr
                      key={id}
                      className="monitor-clickable-row"
                      role="link"
                      tabIndex={0}
                      aria-label={`View details for ${m.name}`}
                      onClick={() => navigate(`/monitors/${id}`)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") navigate(`/monitors/${id}`);
                      }}
                    >
                      <td>
                        <b className="table-primary">{m.name}</b>
                        <small className="table-secondary">{m.url}</small>
                      </td>
                      <td>
                        <Status
                          value={m.status || (m.active ? "unknown" : "paused")}
                        />
                      </td>
                      <td>
                        {stats?.uptimePercentage != null
                          ? formatUptime(stats.uptimePercentage)
                          : "—"}
                      </td>
                      <td>
                        {stats?.avgResponseTime != null
                          ? `${Math.round(stats.avgResponseTime)} ms`
                          : "—"}
                      </td>
                      <td>{m.interval ? `${m.interval}s` : "—"}</td>
                      <td>
                        {m.lastCheckedAt
                          ? new Date(m.lastCheckedAt).toLocaleString()
                          : "—"}
                      </td>
                      <td>
                        <div
                          className="row-actions"
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => event.stopPropagation()}
                        >
                          <button
                            aria-label="Edit"
                            data-tooltip="Edit"
                            onClick={() => openEdit(m)}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            aria-label={m.active ? "Pause" : "Resume"}
                            data-tooltip={m.active ? "Pause" : "Resume"}
                            onClick={() => toggleMonitor(id, !m.active, m.name)}
                          >
                            <>
                              {m.active ? (
                                <Pause size={14} />
                              ) : (
                                <Play size={14} />
                              )}
                            </>
                          </button>
                          <button
                            aria-label="Duplicate"
                            data-tooltip="Duplicate"
                            onClick={() => {
                              setDuplicateSource(m);
                              setEditMonitor(null);
                              setFormOpen(true);
                            }}
                          >
                            <Copy size={14} />
                          </button>
                          <button
                            aria-label="Delete"
                            data-tooltip="Delete"
                            onClick={() => setDeleteTarget(m)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!filteredMonitors.length && (
                  <tr>
                    <td colSpan="7" className="table-empty">
                      {search
                        ? "No monitors match your search."
                        : "No monitors yet. Add your first one to start checking availability."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {pagination && pagination.pages > 1 && (
          <div className="pagination-bar">
            <span>
              Page {pagination.page} of {pagination.pages} · {pagination.total}{" "}
              monitors
            </span>
            <div>
              <Button
                variant="secondary"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                disabled={page >= pagination.pages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Panel>
      {formOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setFormOpen(false)}
        >
          <section
            className="form-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="monitor-form-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sw-panel-heading">
              <div>
                <h2 id="monitor-form-title">
                  {duplicateSource
                    ? "Duplicate monitor"
                    : editMonitor
                      ? "Edit monitor"
                      : "Add a monitor"}
                </h2>
                <p>Configure the endpoint you want to keep an eye on.</p>
              </div>
              <button
                className="modal-close"
                onClick={() => setFormOpen(false)}
              >
                ×
              </button>
            </div>
            <form
              className="sw-form"
              onSubmit={(e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                handleFormSubmit({
                  name: form.get("name"),
                  url: form.get("url"),
                  interval: Number(form.get("interval")),
                  method: form.get("method") || "GET",
                  active: true,
                });
              }}
            >
              <Input
                label="Monitor name"
                name="name"
                placeholder="e.g. Production Web App"
                defaultValue={duplicateSource?.name || editMonitor?.name}
                required
              />
              <Input
                label="Website URL"
                name="url"
                type="url"
                placeholder="https://example.com"
                defaultValue={duplicateSource?.url || editMonitor?.url}
                required
              />
              <Select
                label="Check interval"
                name="interval"
                defaultValue={editMonitor?.interval || 300}
              >
                <option value="60">Every minute</option>
                <option value="300">Every 5 minutes</option>
                <option value="600">Every 10 minutes</option>
                <option value="1800">Every 30 minutes</option>
              </Select>
              <Select
                label="HTTP method"
                name="method"
                defaultValue={editMonitor?.method || "GET"}
              >
                <option>GET</option>
                <option>HEAD</option>
                <option>POST</option>
              </Select>
              <div className="modal-actions">
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => setFormOpen(false)}
                >
                  Cancel
                </Button>
                <Button disabled={submitting}>
                  {submitting ? "Saving…" : "Save monitor"}
                </Button>
              </div>
            </form>
          </section>
        </div>
      )}
      {deleteTarget && (
        <div className="modal-backdrop">
          <section className="form-modal">
            <h2>Delete {deleteTarget.name}?</h2>
            <p className="muted-copy">
              This removes its monitoring history and configuration.
            </p>
            <div className="modal-actions">
              <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                disabled={submitting}
                onClick={() =>
                  deleteMonitor(
                    deleteTarget.id || deleteTarget._id,
                    deleteTarget.name,
                  )
                }
              >
                Delete monitor
              </Button>
            </div>
          </section>
        </div>
      )}
    </Page>
  );
}
