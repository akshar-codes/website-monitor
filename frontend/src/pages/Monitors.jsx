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
import { ROUTES } from "../constants/routes";
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

  return null;
}
