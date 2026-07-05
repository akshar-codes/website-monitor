import { memo } from "react";
import { Link } from "react-router-dom";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import SeverityBadge from "../shared/SeverityBadge";
import StatusBadge from "../shared/StatusBadge";
import RelativeTime from "../shared/RelativeTime";

function ActiveIncidentsList({ incidents }) {
  const hasIncidents = incidents && incidents.length > 0;

  return (
    <div
      id="active-incidents-list"
      className="rounded-xl"
      style={{
        backgroundColor: "var(--surface-raised)",
        border: "1px solid var(--border)",
      }}
    >
      <div
        className="flex items-center justify-between px-5 py-3.5"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <h3
          className="text-sm font-semibold"
          style={{ color: "var(--text-secondary)" }}
        >
          Active Incidents
        </h3>
        {hasIncidents && (
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: "var(--status-down-bg)",
              color: "var(--status-down)",
            }}
          >
            {incidents.length}
          </span>
        )}
      </div>

      {!hasIncidents ? (
        <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
          <div
            className="flex items-center justify-center rounded-full mb-3"
            style={{
              width: 52,
              height: 52,
              backgroundColor: "var(--status-up-bg)",
            }}
          >
            <CheckCircleRoundedIcon
              sx={{ fontSize: 28, color: "var(--status-up)" }}
            />
          </div>
          <p
            className="text-sm font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            All systems operational
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>
            No active incidents at this time
          </p>
        </div>
      ) : (
        <div className="divide-y" style={{ borderColor: "var(--border)" }}>
          {incidents.slice(0, 5).map((incident) => (
            <Link
              key={incident._id}
              to={`/incidents/${incident._id}`}
              id={`incident-link-${incident._id}`}
              className="flex items-center gap-3 px-5 py-3.5 group"
              style={{
                textDecoration: "none",
                transition: "background-color var(--transition-fast)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "var(--surface)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              <div className="flex-1 min-w-0">
                <p
                  className="text-sm font-semibold truncate mb-1"
                  style={{ color: "var(--text-primary)" }}
                >
                  {incident.monitor?.name || "Unknown Monitor"}
                </p>
                <div className="flex items-center flex-wrap gap-2">
                  <SeverityBadge severity={incident.severity} size="sm" />
                  <StatusBadge status={incident.status} size="sm" />
                  <span
                    className="text-xs"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    ·
                  </span>
                  <RelativeTime
                    date={incident.startedAt}
                    className="text-xs!"
                  />
                </div>
              </div>
              <ChevronRightRoundedIcon
                sx={{
                  fontSize: 18,
                  color: "var(--text-tertiary)",
                  flexShrink: 0,
                  transition: "transform var(--transition-fast)",
                  ".group:hover &": { transform: "translateX(2px)" },
                }}
              />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default memo(ActiveIncidentsList);
