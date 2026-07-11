import { useState, useMemo, useCallback } from "react";
import { Plus, Search, Monitor, RefreshCw } from "lucide-react";
import PageContainer from "../components/layout/PageContainer";
import PageHeader from "../components/layout/PageHeader";
import Button from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import MonitorRow from "../features/monitors/MonitorRow";
import MonitorFormModal from "../features/monitors/MonitorFormModal";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import Pagination from "../components/ui/Pagination";
import EmptyState from "../components/ui/EmptyState";
import { SkeletonRow } from "../components/ui/Skeleton";
import { useMonitorList, useMonitorMutations } from "../hooks/useMonitors";
import { useQuery } from "../hooks/useQuery";
import * as dashboardApi from "../services/api/dashboard";
import { cn } from "../utils/cn";

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
          map[m.id || m._id] = results[i].value.data;
        }
      });
      return map;
    },
    [ids],
    { immediate: monitors.length > 0 },
  );
}

export default function Monitors() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editMonitor, setEditMonitor] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const listParams = useMemo(() => {
    const params = { page, limit: 20 };
    if (statusFilter === "active") params.active = "true";
    if (statusFilter === "paused") params.active = "false";
    return params;
  }, [page, statusFilter]);

  const { data: monitorsData, loading, refetch } = useMonitorList(listParams);
  const monitors = useMemo(() => monitorsData?.data || [], [monitorsData]);
  const pagination = monitorsData?.pagination;

  // statsMap initializes as null from useQuery; guard with ?? {} so map access
  // never throws regardless of fetch state (null default only catches undefined).
  const { data: statsMapRaw } =
    useMonitorsWithStats(monitors);
  const statsMap = statsMapRaw ?? {};

  const handleMutationSuccess = useCallback(() => {
    setFormOpen(false);
    setEditMonitor(null);
    setDeleteTarget(null);
    refetch();
  }, [refetch]);

  const {
    createMonitor,
    updateMonitor,
    deleteMonitor,
    toggleMonitor,
    submitting,
  } = useMonitorMutations(handleMutationSuccess);

  const filteredMonitors = useMemo(() => {
    if (!search.trim()) return monitors;
    const q = search.toLowerCase();
    return monitors.filter(
      (m) =>
        m.name.toLowerCase().includes(q) || m.url.toLowerCase().includes(q),
    );
  }, [monitors, search]);

  const handleFormSubmit = (data) => {
    if (editMonitor) {
      updateMonitor(editMonitor.id || editMonitor._id, data);
    } else {
      createMonitor(data);
    }
  };

  const openEdit = (monitor) => {
    setEditMonitor(monitor);
    setFormOpen(true);
  };

  const openCreate = () => {
    setEditMonitor(null);
    setFormOpen(true);
  };

  return (
    <PageContainer>
      <PageHeader
        title="Monitors"
        subtitle="Manage and track all your monitored endpoints"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={RefreshCw}
              onClick={refetch}
            >
              Refresh
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={openCreate}
            >
              Add Monitor
            </Button>
          </div>
        }
        className="mb-6"
      />

      {/* Filters bar */}
      <div className="mb-5 flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-60 max-w-sm">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search monitors…"
            className="pl-9"
          />
        </div>

        {/* Status filter pills */}
        <div className="flex items-center gap-1 rounded-lg border border-border-default bg-bg-elevated p-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => {
                setStatusFilter(f.value);
                setPage(1);
              }}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-all",
                statusFilter === f.value
                  ? "bg-bg-subtle text-white"
                  : "text-text-muted hover:text-text-secondary",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {pagination && (
          <p className="ml-auto text-xs text-text-muted">
            {pagination.total} monitor{pagination.total !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border-subtle bg-bg-surface">
        {/* Column headers */}
        <div className="grid grid-cols-[1fr_100px_100px_90px_90px_100px_40px] items-center gap-3 border-b border-border-subtle px-5 py-3">
          {COLUMN_HEADERS.map((col, i) => (
            <p
              key={i}
              className="text-[11px] font-semibold uppercase tracking-wider text-text-disabled"
            >
              {col.label}
            </p>
          ))}
        </div>

        {/* Rows */}
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
        ) : !filteredMonitors.length ? (
          <EmptyState
            icon={Monitor}
            title={search ? "No monitors match your search" : "No monitors yet"}
            description={
              search
                ? "Try a different search term."
                : "Add your first monitor to start tracking uptime."
            }
            action={
              !search && (
                <Button
                  variant="primary"
                  size="sm"
                  icon={Plus}
                  onClick={openCreate}
                >
                  Add Monitor
                </Button>
              )
            }
            className="py-16"
          />
        ) : (
          filteredMonitors.map((monitor) => (
            <MonitorRow
              key={monitor.id || monitor._id}
              monitor={monitor}
              stats={statsMap[monitor.id || monitor._id]}
              onEdit={() => openEdit(monitor)}
              onDelete={() => setDeleteTarget(monitor)}
              onToggle={() =>
                toggleMonitor(
                  monitor.id || monitor._id,
                  !monitor.active,
                  monitor.name,
                )
              }
            />
          ))
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          onPageChange={setPage}
          className="mt-4"
        />
      )}

      {/* Modals */}
      <MonitorFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditMonitor(null);
        }}
        onSubmit={handleFormSubmit}
        monitor={editMonitor}
        loading={submitting}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() =>
          deleteMonitor(
            deleteTarget?.id || deleteTarget?._id,
            deleteTarget?.name,
          )
        }
        title="Delete Monitor"
        description={`"${deleteTarget?.name}" and all its history will be permanently deleted.`}
        confirmLabel="Delete Monitor"
        loading={submitting}
      />
    </PageContainer>
  );
}
