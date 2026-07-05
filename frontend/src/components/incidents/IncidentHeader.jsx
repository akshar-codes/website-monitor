import { memo } from "react";
import { Link } from "react-router-dom";
import LaunchIcon from "@mui/icons-material/Launch";
import StatusBadge from "../shared/StatusBadge";
import SeverityBadge from "../shared/SeverityBadge";
import { formatDuration, formatDateTime } from "../../utils/formatters";

function IncidentHeader({ incident }) {
  if (!incident) return null;

  return (
    <div
      className="rounded-xl p-6"
      style={{
        background: "var(--surface-raised)",
        border: "1px solid var(--border)",
      }}
    >
      <div className="flex flex-col gap-4">
        {/* Monitor info */}
        <div
          className="flex items-center gap-2 text-sm"
          style={{ color: "var(--text-secondary)" }}
        >
          <Link
            to={`/monitors/${incident.monitor?._id || incident.monitor?.id}`}
            className="font-medium hover:underline"
            style={{ color: "var(--primary)" }}
          >
            {incident.monitor?.name || "Unknown Monitor"}
          </Link>
          {incident.monitor?.url && (
            <a
              href={incident.monitor.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1"
              style={{ color: "var(--text-tertiary)" }}
            >
              <LaunchIcon sx={{ fontSize: 14 }} />
            </a>
          )}
        </div>

        {/* Badges */}
        <div className="flex flex-wrap items-center gap-3">
          <h1
            className="text-xl font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            Incident
          </h1>
          <SeverityBadge severity={incident.severity} />
          <StatusBadge status={incident.status} />
        </div>

        {/* Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <span
              className="font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              Started:{" "}
            </span>
            <span style={{ color: "var(--text-primary)" }}>
              {formatDateTime(incident.startedAt)}
            </span>
          </div>
          {incident.endedAt && (
            <div>
              <span
                className="font-medium"
                style={{ color: "var(--text-secondary)" }}
              >
                Resolved:{" "}
              </span>
              <span style={{ color: "var(--text-primary)" }}>
                {formatDateTime(incident.endedAt)}
              </span>
            </div>
          )}
          <div>
            <span
              className="font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              Duration:{" "}
            </span>
            <span style={{ color: "var(--text-primary)" }}>
              {formatDuration(incident.startedAt, incident.endedAt)}
            </span>
          </div>
        </div>

        {/* Root cause */}
        {incident.rootCause && (
          <div className="mt-2">
            <h3
              className="text-sm font-semibold mb-1"
              style={{ color: "var(--text-secondary)" }}
            >
              Root Cause
            </h3>
            <p className="text-sm" style={{ color: "var(--text-primary)" }}>
              {incident.rootCause}
            </p>
          </div>
        )}

        {/* Resolution notes */}
        {incident.resolutionNotes && (
          <div>
            <h3
              className="text-sm font-semibold mb-1"
              style={{ color: "var(--text-secondary)" }}
            >
              Resolution Notes
            </h3>
            <p className="text-sm" style={{ color: "var(--text-primary)" }}>
              {incident.resolutionNotes}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(IncidentHeader);
