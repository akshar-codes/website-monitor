import { memo, useState, useCallback, useMemo } from "react";
import Button from "@mui/material/Button";
import DnsRoundedIcon from "@mui/icons-material/DnsRounded";
import toast from "react-hot-toast";
import { useMonitors } from "../hooks/queries/useMonitors";
import { useFilters } from "../providers/FilterProvider";
import { useDeleteMonitor } from "../hooks/mutations/useDeleteMonitor";
import { useUpdateMonitor } from "../hooks/mutations/useUpdateMonitor";
import LoadingSkeleton from "../components/shared/LoadingSkeleton";
import ErrorBanner from "../components/shared/ErrorBanner";
import EmptyState from "../components/shared/EmptyState";
import Pagination from "../components/shared/Pagination";
import ConfirmDialog from "../components/shared/ConfirmDialog";
import MonitorToolbar from "../components/monitors/MonitorToolbar";
import MonitorList from "../components/monitors/MonitorList";
import CreateMonitorModal from "../components/monitors/CreateMonitorModal";
import EditMonitorModal from "../components/monitors/EditMonitorModal";

function MonitorsPage() {
  const { monitorFilters, setMonitorFilters } = useFilters();
  const { data, isLoading, isError, error, refetch } =
    useMonitors(monitorFilters);
  const deleteMutation = useDeleteMonitor();
  const updateMutation = useUpdateMonitor();

  // Local state
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingMonitor, setEditingMonitor] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingMonitor, setDeletingMonitor] = useState(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const monitors = data?.data || [];
  const pagination = data?.pagination || {};

  const isAllSelected = useMemo(
    () => monitors.length > 0 && monitors.every((m) => selectedIds.has(m._id)),
    [monitors, selectedIds],
  );

  // Selection handlers
  const handleToggleSelect = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(monitors.map((m) => m._id)));
    }
  }, [isAllSelected, monitors]);

  // Create
  const handleOpenCreate = useCallback(() => setCreateModalOpen(true), []);
  const handleCloseCreate = useCallback(() => setCreateModalOpen(false), []);

  // Edit
  const handleEdit = useCallback((monitor) => {
    setEditingMonitor(monitor);
    setEditModalOpen(true);
  }, []);

  const handleCloseEdit = useCallback(() => {
    setEditModalOpen(false);
    setEditingMonitor(null);
  }, []);

  // Delete
  const handleDeleteClick = useCallback((monitor) => {
    setDeletingMonitor(monitor);
    setDeleteDialogOpen(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deletingMonitor) return;
    try {
      await deleteMutation.mutateAsync(deletingMonitor._id);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(deletingMonitor._id);
        return next;
      });
    } finally {
      setDeleteDialogOpen(false);
      setDeletingMonitor(null);
    }
  }, [deletingMonitor, deleteMutation]);

  const handleCloseDeleteDialog = useCallback(() => {
    setDeleteDialogOpen(false);
    setDeletingMonitor(null);
  }, []);

  // Toggle active
  const handleToggleActive = useCallback(
    async (monitor) => {
      try {
        await updateMutation.mutateAsync({
          id: monitor._id,
          data: { active: !monitor.active },
        });
      } catch {
        // Error handled in mutation hook
      }
    },
    [updateMutation],
  );

  // Bulk actions
  const handleBulkPause = useCallback(async () => {
    const ids = Array.from(selectedIds);
    const results = await Promise.allSettled(
      ids.map((id) =>
        updateMutation.mutateAsync({ id, data: { active: false } }),
      ),
    );
    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed > 0) {
      toast.error(`Failed to pause ${failed} monitor(s)`);
    } else {
      toast.success(`Paused ${ids.length} monitor(s)`);
    }
    setSelectedIds(new Set());
  }, [selectedIds, updateMutation]);

  const handleBulkResume = useCallback(async () => {
    const ids = Array.from(selectedIds);
    const results = await Promise.allSettled(
      ids.map((id) =>
        updateMutation.mutateAsync({ id, data: { active: true } }),
      ),
    );
    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed > 0) {
      toast.error(`Failed to resume ${failed} monitor(s)`);
    } else {
      toast.success(`Resumed ${ids.length} monitor(s)`);
    }
    setSelectedIds(new Set());
  }, [selectedIds, updateMutation]);

  const handleBulkDelete = useCallback(() => {
    setBulkDeleteOpen(true);
  }, []);

  const handleConfirmBulkDelete = useCallback(async () => {
    const ids = Array.from(selectedIds);
    const results = await Promise.allSettled(
      ids.map((id) => deleteMutation.mutateAsync(id)),
    );
    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed > 0) {
      toast.error(`Failed to delete ${failed} monitor(s)`);
    } else {
      toast.success(`Deleted ${ids.length} monitor(s)`);
    }
    setSelectedIds(new Set());
    setBulkDeleteOpen(false);
  }, [selectedIds, deleteMutation]);

  const handleCloseBulkDelete = useCallback(() => {
    setBulkDeleteOpen(false);
  }, []);

  // Pagination
  const handlePageChange = useCallback(
    (page) => {
      setMonitorFilters({ page });
      setSelectedIds(new Set());
    },
    [setMonitorFilters],
  );

  // Filter changes
  const handleFilterChange = useCallback(
    (updates) => {
      setMonitorFilters(updates);
      setSelectedIds(new Set());
    },
    [setMonitorFilters],
  );

  // Loading
  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in" id="monitors-loading">
        <div className="flex items-center justify-between">
          <div>
            <h1
              className="text-xl sm:text-2xl font-bold tracking-tight"
              style={{ color: "var(--text-primary)" }}
            >
              Monitors
            </h1>
            <p
              className="text-sm mt-0.5"
              style={{ color: "var(--text-tertiary)" }}
            >
              Manage your website monitoring targets
            </p>
          </div>
        </div>
        <LoadingSkeleton variant="card" count={6} />
      </div>
    );
  }

  // Error
  if (isError) {
    return (
      <div className="space-y-6 animate-fade-in" id="monitors-error">
        <div>
          <h1
            className="text-xl sm:text-2xl font-bold tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            Monitors
          </h1>
          <p
            className="text-sm mt-0.5"
            style={{ color: "var(--text-tertiary)" }}
          >
            Manage your website monitoring targets
          </p>
        </div>
        <ErrorBanner error={error} onRetry={refetch} />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" id="monitors-page">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-xl sm:text-2xl font-bold tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            Monitors
          </h1>
          <p
            className="text-sm mt-0.5"
            style={{ color: "var(--text-tertiary)" }}
          >
            {pagination.total != null
              ? `${pagination.total} monitor${pagination.total !== 1 ? "s" : ""} configured`
              : "Manage your website monitoring targets"}
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <MonitorToolbar
        onCreateClick={handleOpenCreate}
        filters={monitorFilters}
        onFilterChange={handleFilterChange}
        selectedCount={selectedIds.size}
        onBulkPause={handleBulkPause}
        onBulkResume={handleBulkResume}
        onBulkDelete={handleBulkDelete}
      />

      {/* Monitor list or empty state */}
      {monitors.length === 0 ? (
        <EmptyState
          icon={<DnsRoundedIcon sx={{ fontSize: 36, opacity: 0.6 }} />}
          title="No monitors found"
          message="Get started by adding your first monitor to track your websites and services."
          action={
            <Button
              id="empty-create-monitor-btn"
              variant="contained"
              onClick={handleOpenCreate}
              sx={{
                bgcolor: "var(--primary)",
                fontWeight: 600,
                "&:hover": { bgcolor: "var(--primary-hover)" },
              }}
            >
              Add Your First Monitor
            </Button>
          }
        />
      ) : (
        <>
          <MonitorList
            monitors={monitors}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onSelectAll={handleSelectAll}
            isAllSelected={isAllSelected}
            onEdit={handleEdit}
            onDelete={handleDeleteClick}
            onToggleActive={handleToggleActive}
          />

          <Pagination
            page={monitorFilters.page || 1}
            totalPages={pagination.totalPages}
            onPageChange={handlePageChange}
            total={pagination.total}
          />
        </>
      )}

      {/* Create modal */}
      <CreateMonitorModal open={createModalOpen} onClose={handleCloseCreate} />

      {/* Edit modal */}
      <EditMonitorModal
        open={editModalOpen}
        onClose={handleCloseEdit}
        monitor={editingMonitor}
      />

      {/* Single delete confirm */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onClose={handleCloseDeleteDialog}
        onConfirm={handleConfirmDelete}
        title="Delete Monitor"
        message={`Are you sure you want to delete "${deletingMonitor?.name}"? This will also remove all associated health checks and incidents. This action cannot be undone.`}
        confirmText="Delete"
        confirmColor="error"
        loading={deleteMutation.isPending}
      />

      {/* Bulk delete confirm */}
      <ConfirmDialog
        open={bulkDeleteOpen}
        onClose={handleCloseBulkDelete}
        onConfirm={handleConfirmBulkDelete}
        title="Delete Selected Monitors"
        message={`Are you sure you want to delete ${selectedIds.size} selected monitor(s)? This will also remove all associated health checks and incidents. This action cannot be undone.`}
        confirmText="Delete All"
        confirmColor="error"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}

export default memo(MonitorsPage);
