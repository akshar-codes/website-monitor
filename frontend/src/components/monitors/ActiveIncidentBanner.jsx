import { memo } from "react";
import { Link } from "react-router-dom";
import WarningIcon from "@mui/icons-material/Warning";
import StatusBadge from "../shared/StatusBadge";
import SeverityBadge from "../shared/SeverityBadge";
import RelativeTime from "../shared/RelativeTime";
import { formatDuration } from "../../utils/formatters";

function ActiveIncidentBanner({ incident }) {
  if (!incident) return null;

  return (
    <Link
      to={`/incidents/${incident._id || incident.id}`}
      id="active-incident-banner"
      className="block rounded-xl p-4 transition-shadow duration-200 animate-fade-in"
      style={{
        background: "var(--severity-critical-bg)",
        border: "1px solid var(--severity-critical)",
        boxShadow: "var(--shadow-sm)",
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.boxShadow = "var(--shadow-md)")
      }
      onMouseLeave={(e) =>
        (e.currentTarget.style.boxShadow = "var(--shadow-sm)")
      }
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <WarningIcon sx={{ color: "var(--severity-critical)", fontSize: 24 }} />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span
              className="text-sm font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              Active Incident
            </span>
            <SeverityBadge severity={incident.severity} size="sm" />
            <StatusBadge status={incident.status} size="sm" />
          </div>
          <div
            className="flex flex-wrap gap-x-4 gap-y-1 text-xs"
            style={{ color: "var(--text-secondary)" }}
          >
            <span>
              Started <RelativeTime date={incident.startedAt} />
            </span>
            <span>
              Duration: {formatDuration(incident.startedAt, incident.endedAt)}
            </span>
          </div>
        </div>
        <span
          className="text-xs font-medium"
          style={{ color: "var(--primary)" }}
        >
          View Details →
        </span>
      </div>
    </Link>
  );
}

export default memo(ActiveIncidentBanner);
