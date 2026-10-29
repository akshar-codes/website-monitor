import { useMemo, useState, useCallback } from "react";
import {
  useIncidentHistory,
  useIncidentDetails,
  useUpdateIncidentStatus,
} from "../hooks/useIncidents";
import { useUsage } from "../hooks/useUsage";
import { useAuth } from "../hooks/useAuth";
import { PLANS } from "../constants/plans";
import { cn } from "../utils/cn";

export default function IncidentHistory() {
  const { plan } = useAuth();
  const defaultWindow = plan === PLANS.FREE ? "7d" : "30d";

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [order, setOrder] = useState("desc");
  const [dateRange, setDateRange] = useState({
    mode: "preset",
    window: defaultWindow,
  });
  const [viewMode, setViewMode] = useState("timeline"); // "timeline" | "cards"
  const [selectedIncidentId, setSelectedIncidentId] = useState(null);

  const { data: usageData } = useUsage();
  const retentionDays = usageData?.data?.retention?.days;

  const listParams = useMemo(() => {
    const params = { page, limit: 20, order, status: statusFilter };
    if (severityFilter !== "all") params.severity = severityFilter;
    if (search.trim()) params.search = search.trim();
    if (
      dateRange.mode === "custom" &&
      dateRange.startDate &&
      dateRange.endDate
    ) {
      params.startDate = dateRange.startDate;
      params.endDate = dateRange.endDate;
    } else {
      params.window = dateRange.window || "30d";
    }
    return params;
  }, [page, order, statusFilter, severityFilter, search, dateRange]);

  const { data, loading, refetch } = useIncidentHistory(listParams);
  const incidents = data?.data || [];
  const pagination = data?.pagination;

  const hasActiveFilters =
    severityFilter !== "all" ||
    statusFilter !== "all" ||
    !!search.trim() ||
    dateRange.mode === "custom";

  const {
    data: incidentDetailData,
    loading: incidentDetailLoading,
    refetch: refetchIncidentDetail,
  } = useIncidentDetails(selectedIncidentId);
  const selectedIncident = incidentDetailData?.data;

  const handleUpdateSuccess = useCallback(() => {
    refetchIncidentDetail();
    refetch();
  }, [refetchIncidentDetail, refetch]);

  const { updateStatus, submitting: updatingStatus } =
    useUpdateIncidentStatus(handleUpdateSuccess);

  const handleSearchChange = (value) => {
    setSearch(value);
    setPage(1);
  };

  const handleSeverityFilterChange = (value) => {
    setSeverityFilter(value);
    setPage(1);
  };

  const handleStatusFilterChange = (value) => {
    setStatusFilter(value);
    setPage(1);
  };

  const handleDateRangeChange = (value) => {
    setDateRange(value);
    setPage(1);
  };

  const toggleOrder = () => {
    setOrder((prev) => (prev === "desc" ? "asc" : "desc"));
  };

  return null;
}
