import { memo } from "react";
import Tooltip from "@mui/material/Tooltip";

const STATUS_DOT_COLORS = {
  up: "var(--status-up)",
  down: "var(--status-down)",
  degraded: "var(--status-degraded)",
  unknown: "var(--status-unknown)",
};

const LABELS = {
  frontend: "Frontend",
  backend: "Backend",
  database: "Database",
};

function Dot({ component, status }) {
  const color = STATUS_DOT_COLORS[status] || STATUS_DOT_COLORS.unknown;
  const label = LABELS[component] || component;
  const statusLabel = status
    ? status.charAt(0).toUpperCase() + status.slice(1)
    : "Unknown";

  return (
    <Tooltip
      title={`${label}: ${statusLabel}`}
      arrow
      placement="top"
      slotProps={{
        tooltip: {
          sx: {
            bgcolor: "var(--surface-raised)",
            color: "var(--text-primary)",
            fontSize: "0.75rem",
            fontWeight: 500,
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-md)",
            "& .MuiTooltip-arrow": {
              color: "var(--surface-raised)",
              "&::before": {
                border: "1px solid var(--border)",
              },
            },
          },
        },
      }}
    >
      <span
        id={`status-dot-${component}`}
        style={{
          width: 8,
          height: 8,
          borderRadius: "var(--radius-full)",
          backgroundColor: color,
          display: "inline-block",
          cursor: "pointer",
          transition: "transform var(--transition-fast)",
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "scale(1.4)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1)";
        }}
      />
    </Tooltip>
  );
}

function ComponentStatusDots({
  frontendStatus,
  backendStatus,
  databaseStatus,
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Dot component="frontend" status={frontendStatus} />
      <Dot component="backend" status={backendStatus} />
      <Dot component="database" status={databaseStatus} />
    </span>
  );
}

export default memo(ComponentStatusDots);
