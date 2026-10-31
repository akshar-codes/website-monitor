import { useMemo, useState, useCallback, useEffect } from "react";
import {
  useIncidentHistory,
  useIncidentDetails,
  useUpdateIncidentStatus,
} from "../hooks/useIncidents";
import { useUsage } from "../hooks/useUsage";
import { useAuth } from "../hooks/useAuth";
import { PLANS } from "../constants/plans";
import {
  Page,
  Panel,
  Button,
  Select,
  Input,
  Status,
  Table,
  Metric,
} from "../components/ui/Primitives";
import {
  RefreshCw,
  CheckCircle2,
  ArrowUpDown,
  AlertTriangle,
  Clock3,
} from "lucide-react";
import * as alertingApi from "../services/api/alerting";
import { toast } from "sonner";

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
  const [viewMode] = useState("timeline");
  const [selectedIncidentId, setSelectedIncidentId] = useState(null);
  const [escalationData, setEscalationData] = useState(null);
  const [acknowledging, setAcknowledging] = useState(false);

  const { data: usageData } = useUsage();
  const _retentionDays = usageData?.data?.retention?.days;

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
    loading: _incidentDetailLoading,
    refetch: refetchIncidentDetail,
  } = useIncidentDetails(selectedIncidentId);
  const selectedIncident = incidentDetailData?.data;
  useEffect(() => {
    if (!selectedIncidentId) return undefined;
    let current = true;
    alertingApi
      .getIncidentEscalations(selectedIncidentId)
      .then((data) => {
        if (current)
          setEscalationData({ incidentId: selectedIncidentId, data });
      })
      .catch(() => {
        if (current)
          setEscalationData({ incidentId: selectedIncidentId, data: null });
      });
    return () => {
      current = false;
    };
  }, [selectedIncidentId]);
  const refreshEscalations = async () => {
    try {
      setEscalationData({
        incidentId: selectedIncidentId,
        data: await alertingApi.getIncidentEscalations(selectedIncidentId),
      });
    } catch {
      toast.error("Could not refresh acknowledgement details");
    }
  };
  const currentEscalationData =
    escalationData?.incidentId === selectedIncidentId
      ? escalationData.data
      : null;
  const setAcknowledgement = async (acknowledge) => {
    if (!selectedIncidentId) return;
    setAcknowledging(true);
    try {
      if (acknowledge)
        await alertingApi.acknowledgeIncident(selectedIncidentId);
      else await alertingApi.removeIncidentAcknowledgement(selectedIncidentId);
      toast.success(
        acknowledge ? "Incident acknowledged" : "Acknowledgement removed",
      );
      await refreshEscalations();
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Could not update acknowledgement",
      );
    } finally {
      setAcknowledging(false);
    }
  };

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

  const rows = incidents.map((incident) => ({
    ...incident,
    monitorName: incident.monitor?.name || incident.monitorName || "Monitor",
    started: incident.startedAt || incident.createdAt,
    ended: incident.resolvedAt,
    displayStatus: incident.status || "open",
    summary:
      incident.title ||
      incident.message ||
      incident.description ||
      "Service interruption",
  }));
  const columns = [
    { key: "monitorName", label: "Monitor" },
    { key: "summary", label: "Incident" },
    {
      key: "severity",
      label: "Severity",
      render: (v) => <Status value={v || "unknown"} />,
    },
    {
      key: "displayStatus",
      label: "Status",
      render: (v) => <Status value={v} />,
    },
    {
      key: "started",
      label: "Started",
      render: (v) => (v ? new Date(v).toLocaleString() : "—"),
    },
    {
      key: "duration",
      label: "Duration",
      render: (_, row) =>
        row.ended
          ? `${Math.max(1, Math.round((new Date(row.ended) - new Date(row.started)) / 60000))} min`
          : "Ongoing",
    },
    {
      key: "actions",
      label: "",
      render: (_, row) => (
        <Button
          variant="secondary"
          onClick={() => setSelectedIncidentId(row.id || row._id)}
        >
          Details
        </Button>
      ),
    },
  ];
  return (
    <Page
      title="Incidents"
      description="Review downtime, investigate causes, and track recovery."
      actions={
        <Button variant="secondary" onClick={() => refetch()}>
          <RefreshCw size={14} /> Refresh
        </Button>
      }
    >
      <div className="sw-metric-grid">
        <Metric
          label="Active incidents"
          value={
            data?.summary?.active ??
            incidents.filter((x) => x.status !== "resolved").length
          }
          icon={AlertTriangle}
          tone="red"
          note="Require attention"
        />
        <Metric
          label="Incidents in range"
          value={pagination?.total ?? incidents.length}
          icon={Clock3}
          note={dateRange.window || "Selected period"}
        />
        <Metric
          label="Resolved"
          value={incidents.filter((x) => x.status === "resolved").length}
          icon={CheckCircle2}
          note="In this page"
        />
        <Metric
          label="Current view"
          value={viewMode === "timeline" ? "Timeline" : "Table"}
          icon={ArrowUpDown}
          note={`${order === "desc" ? "Newest first" : "Oldest first"}`}
        />
      </div>
      <Panel
        title="Incident history"
        subtitle="Filter by date, status, or severity"
      >
        <div className="incident-toolbar">
          <Input
            aria-label="Search incidents"
            placeholder="Search incidents or monitors"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
          <Select
            aria-label="Status"
            value={statusFilter}
            onChange={(e) => handleStatusFilterChange(e.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="open">Open</option>
            <option value="investigating">Investigating</option>
            <option value="resolved">Resolved</option>
          </Select>
          <Select
            aria-label="Severity"
            value={severityFilter}
            onChange={(e) => handleSeverityFilterChange(e.target.value)}
          >
            <option value="all">All severity</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </Select>
          <Select
            aria-label="Date range"
            value={dateRange.window || defaultWindow}
            onChange={(e) =>
              handleDateRangeChange({ mode: "preset", window: e.target.value })
            }
          >
            <option value="24h">24 hours</option>
            <option value="7d">7 days</option>
            <option value="30d">30 days</option>
            <option value="90d">90 days</option>
          </Select>
          <Button variant="secondary" onClick={toggleOrder}>
            <ArrowUpDown size={14} />
            {order === "desc" ? "Newest" : "Oldest"}
          </Button>
        </div>
        {loading ? (
          <div className="sw-loading">Loading incidents…</div>
        ) : viewMode === "timeline" ? (
          <div className="timeline-list">
            {rows.map((row, i) => (
              <div
                className="timeline-item incident-timeline"
                key={row.id || row._id || i}
              >
                <i
                  className={row.displayStatus === "resolved" ? "resolved" : ""}
                />
                <div>
                  <b>
                    {row.summary} · {row.monitorName}
                  </b>
                  <p>
                    <Status value={row.severity} /> <span> · </span>
                    <Status value={row.displayStatus} />
                    {row.ended && (
                      <span>
                        {" "}
                        · Recovered {new Date(row.ended).toLocaleString()}
                      </span>
                    )}
                  </p>
                </div>
                <time>
                  {row.started ? new Date(row.started).toLocaleString() : "—"}
                </time>
              </div>
            ))}
            {!rows.length && (
              <div className="sw-empty">
                <b>No incidents found</b>
                <p>
                  {hasActiveFilters
                    ? "Try adjusting the selected filters."
                    : "When a monitor has an outage, it will appear here."}
                </p>
              </div>
            )}
          </div>
        ) : (
          <Table
            columns={columns}
            rows={rows}
            empty="No incidents match your filters."
          />
        )}
        {pagination && (
          <div className="pagination-bar">
            <span>
              Page {pagination.page} of {pagination.totalPages} ·{" "}
              {pagination.total} incidents
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
                disabled={page >= pagination.totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Panel>
      {selectedIncident && (
        <div className="modal-backdrop">
          <section className="form-modal">
            <h2>
              {selectedIncident.title ||
                selectedIncident.message ||
                "Incident details"}
            </h2>
            <p className="muted-copy">
              {selectedIncident.description ||
                selectedIncident.monitor?.name ||
                "Incident record"}
            </p>
            <p>
              <Status value={selectedIncident.status} />
            </p>
            {currentEscalationData?.acknowledgement ? (
              <p className="text-sm text-emerald-800">
                Acknowledged{" "}
                {new Date(
                  currentEscalationData.acknowledgement.acknowledgedAt,
                ).toLocaleString()}
                {currentEscalationData.acknowledgement.acknowledgedBy?.name
                  ? ` by ${currentEscalationData.acknowledgement.acknowledgedBy.name}`
                  : ""}
              </p>
            ) : null}
            {selectedIncident.status !== "resolved" && (
              <Button
                variant="secondary"
                disabled={acknowledging}
                onClick={() =>
                  setAcknowledgement(!currentEscalationData?.acknowledgement)
                }
              >
                {acknowledging
                  ? "Saving…"
                  : currentEscalationData?.acknowledgement
                    ? "Remove acknowledgement"
                    : "Acknowledge incident"}
              </Button>
            )}
            {currentEscalationData?.executions?.length > 0 && (
              <section className="mt-4 rounded-lg border p-3">
                <h3 className="font-semibold">Escalation history</h3>
                <ul className="mt-2 grid gap-2 text-sm">
                  {currentEscalationData.executions.map((execution) => (
                    <li key={execution._id}>
                      {execution.policy?.name || "Policy"}: {execution.status} ·
                      step {execution.currentStep}
                      {execution.repeatCount
                        ? ` · ${execution.repeatCount} repeat(s)`
                        : ""}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {selectedIncident.status !== "resolved" && (
              <Button
                disabled={updatingStatus}
                onClick={() =>
                  updateStatus(selectedIncident.id || selectedIncident._id, {
                    status: "resolved",
                  })
                }
              >
                {updatingStatus ? "Saving…" : "Mark resolved"}
              </Button>
            )}
            <div className="modal-actions">
              <Button
                variant="secondary"
                onClick={() => setSelectedIncidentId(null)}
              >
                Close
              </Button>
            </div>
          </section>
        </div>
      )}
    </Page>
  );
}
