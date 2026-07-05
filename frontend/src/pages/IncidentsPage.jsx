import { useState } from "react";
import { useFilters } from "../providers/FilterProvider";
import { useIncidents } from "../hooks/queries/useIncidents";
import { useDowntimeStats } from "../hooks/queries/useDowntimeStats";
import IncidentFilters from "../components/incidents/IncidentFilters";
import IncidentTable from "../components/incidents/IncidentTable";
import DowntimeStatsCards from "../components/incidents/DowntimeStatsCards";
import Pagination from "../components/shared/Pagination";
import WindowSelector from "../components/shared/WindowSelector";
import ErrorBanner from "../components/shared/ErrorBanner";

export default function IncidentsPage() {
  const { incidentFilters, setIncidentFilters } = useFilters();
  const { data, isPending, isError, error } = useIncidents(incidentFilters);
  const [statsWindow, setStatsWindow] = useState("30d");
  const downtimeStats = useDowntimeStats({ window: statsWindow });

  const incidents = data?.data || data || [];
  const pagination = data?.pagination;

  if (isError) {
    return (
      <ErrorBanner error={error} onRetry={() => window.location.reload()} />
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Downtime Stats ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2
            className="text-base font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            Downtime Overview
          </h2>
          <WindowSelector value={statsWindow} onChange={setStatsWindow} />
        </div>
        <DowntimeStatsCards
          stats={downtimeStats.data}
          loading={downtimeStats.isPending}
        />
      </div>

      {/* ── Filters ── */}
      <IncidentFilters
        filters={incidentFilters}
        onFilterChange={setIncidentFilters}
      />

      {/* ── Table ── */}
      <IncidentTable incidents={incidents} loading={isPending} />

      {/* ── Pagination ── */}
      {pagination && (
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          onPageChange={(page) => setIncidentFilters({ page })}
        />
      )}
    </div>
  );
}
