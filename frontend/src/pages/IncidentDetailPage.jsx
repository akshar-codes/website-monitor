import { useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { useIncident } from "../hooks/queries/useIncident";
import { useUpdateIncidentStatus } from "../hooks/mutations/useUpdateIncidentStatus";
import IncidentHeader from "../components/incidents/IncidentHeader";
import IncidentTimeline from "../components/incidents/IncidentTimeline";
import TriggerCheckCard from "../components/incidents/TriggerCheckCard";
import IncidentStatusActions from "../components/incidents/IncidentStatusActions";
import ErrorBanner from "../components/shared/ErrorBanner";
import LoadingSkeleton from "../components/shared/LoadingSkeleton";
import { Button } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

export default function IncidentDetailPage() {
  const { id } = useParams();
  const { data: incident, isPending, isError, error } = useIncident(id);
  const statusMutation = useUpdateIncidentStatus();

  const handleStatusUpdate = useCallback(
    (incidentId, data) => {
      statusMutation.mutate({ id: incidentId, data });
    },
    [statusMutation],
  );

  if (isPending) {
    return (
      <div className="space-y-6 animate-fade-in">
        <LoadingSkeleton variant="card" count={1} />
        <LoadingSkeleton variant="card" count={2} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-4 animate-fade-in">
        <ErrorBanner
          error={error?.message || "Failed to load incident"}
          onRetry={() => window.location.reload()}
        />
        <Link to="/incidents">
          <Button
            startIcon={<ArrowBackIcon />}
            variant="outlined"
            sx={{
              borderColor: "var(--border)",
              color: "var(--text-primary)",
              fontFamily: "var(--font-sans)",
              textTransform: "none",
            }}
          >
            Back to Incidents
          </Button>
        </Link>
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="space-y-4 animate-fade-in">
        <ErrorBanner error="Incident not found" />
        <Link to="/incidents">
          <Button
            startIcon={<ArrowBackIcon />}
            variant="outlined"
            sx={{
              borderColor: "var(--border)",
              color: "var(--text-primary)",
              fontFamily: "var(--font-sans)",
              textTransform: "none",
            }}
          >
            Back to Incidents
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <Link
        to="/incidents"
        className="inline-flex items-center gap-1 text-sm hover:underline"
        style={{ color: "var(--primary)" }}
      >
        <ArrowBackIcon sx={{ fontSize: 16 }} /> Back to Incidents
      </Link>

      <IncidentHeader incident={incident} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <IncidentTimeline incident={incident} />
          <TriggerCheckCard check={incident.triggerCheck} />
        </div>
        <div>
          <IncidentStatusActions
            incident={incident}
            onStatusUpdate={handleStatusUpdate}
            loading={statusMutation.isPending}
          />
        </div>
      </div>
    </div>
  );
}
