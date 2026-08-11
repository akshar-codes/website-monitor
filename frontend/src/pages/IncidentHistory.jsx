import { useMemo, useState, useCallback } from "react";
import {
  RefreshCw,
  LayoutList,
  GanttChartSquare,
  ArrowUpDown,
  AlertTriangle,
} from "lucide-react";
import PageContainer from "../components/layout/PageContainer";
import PageHeader from "../components/layout/PageHeader";
import Button from "../components/ui/Button";
import Pagination from "../components/ui/Pagination";
import SectionLabel from "../components/ui/SectionLabel";
import EmptyState from "../components/ui/EmptyState";
import { SkeletonCard } from "../components/ui/Skeleton";
import IncidentFilters from "../features/incidents/IncidentFilters";
import IncidentTimeline from "../features/incidents/IncidentTimeline";
import IncidentCard from "../features/incidents/IncidentCard";
import IncidentDetailsModal from "../features/incidents/IncidentDetailsModal";
import DowntimeSummary from "../features/incidents/DowntimeSummary";
import {
  useIncidentHistory,
  useIncidentDetails,
  useUpdateIncidentStatus,
} from "../hooks/useIncidents";
import { useUsage } from "../hooks/useUsage";
import { cn } from "../utils/cn";

export default function IncidentHistory() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [order, setOrder] = useState("desc");
  const [dateRange, setDateRange] = useState({
    mode: "preset",
    window: "30d",
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

  return (
    <PageContainer>
      <PageHeader
        title="Incident History"
        subtitle="Complete chronological record of every incident across your monitors"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={ArrowUpDown}
              onClick={toggleOrder}
            >
              {order === "desc" ? "Newest first" : "Oldest first"}
            </Button>

            <div className="flex items-center gap-0.5 rounded-lg border border-border-default bg-bg-elevated p-0.5">
              <button
                onClick={() => setViewMode("timeline")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all",
                  viewMode === "timeline"
                    ? "bg-bg-subtle text-white"
                    : "text-text-muted hover:text-text-secondary",
                )}
              >
                <GanttChartSquare size={13} /> Timeline
              </button>
              <button
                onClick={() => setViewMode("cards")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all",
                  viewMode === "cards"
                    ? "bg-bg-subtle text-white"
                    : "text-text-muted hover:text-text-secondary",
                )}
              >
                <LayoutList size={13} /> Cards
              </button>
            </div>

            <Button
              variant="secondary"
              size="sm"
              icon={RefreshCw}
              onClick={refetch}
            >
              Refresh
            </Button>
          </div>
        }
        className="mb-6"
      />

      <div className="mb-6">
        <DowntimeSummary />
      </div>

      <div>
        <SectionLabel className="mb-3">All Incidents</SectionLabel>

        <IncidentFilters
          search={search}
          onSearchChange={handleSearchChange}
          severityFilter={severityFilter}
          onSeverityFilterChange={handleSeverityFilterChange}
          statusFilter={statusFilter}
          onStatusFilterChange={handleStatusFilterChange}
          dateRange={dateRange}
          onDateRangeChange={handleDateRangeChange}
          retentionDays={retentionDays}
          totalCount={pagination?.total}
        />

        {viewMode === "timeline" ? (
          <IncidentTimeline
            incidents={incidents}
            loading={loading}
            hasActiveFilters={hasActiveFilters}
            onSelectIncident={(incident) =>
              setSelectedIncidentId(incident.id || incident._id)
            }
          />
        ) : loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : !incidents.length ? (
          <EmptyState
            icon={AlertTriangle}
            title={
              hasActiveFilters
                ? "No incidents match your filters"
                : "No incidents recorded"
            }
            description={
              hasActiveFilters
                ? "Try a different search term or clear your filters."
                : "Incidents affecting your monitors will appear here."
            }
            className="rounded-xl border border-border-subtle bg-bg-surface py-16"
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {incidents.map((incident) => (
              <IncidentCard
                key={incident.id || incident._id}
                incident={incident}
                onClick={(inc) => setSelectedIncidentId(inc.id || inc._id)}
              />
            ))}
          </div>
        )}

        {pagination && pagination.totalPages > 1 && (
          <Pagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            onPageChange={setPage}
            className="mt-4"
          />
        )}
      </div>

      <IncidentDetailsModal
        open={!!selectedIncidentId}
        onClose={() => setSelectedIncidentId(null)}
        incident={selectedIncident}
        loading={incidentDetailLoading}
        onUpdateStatus={(id, payload) => updateStatus(id, payload)}
        updating={updatingStatus}
      />
    </PageContainer>
  );
}