import { memo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Button from "@mui/material/Button";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DnsRoundedIcon from "@mui/icons-material/DnsRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import BoltRoundedIcon from "@mui/icons-material/BoltRounded";

const actionButtonSx = {
  justifyContent: "flex-start",
  gap: 1.5,
  fontWeight: 600,
  fontSize: "0.825rem",
  textTransform: "none",
  color: "var(--text-primary)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  px: 2,
  py: 1.25,
  "&:hover": {
    borderColor: "var(--border-hover)",
    bgcolor: "var(--surface)",
  },
};

function QuickActionsPanel({ onAddMonitor }) {
  const navigate = useNavigate();

  const goToMonitors = useCallback(() => navigate("/monitors"), [navigate]);
  const goToIncidents = useCallback(() => navigate("/incidents"), [navigate]);

  return (
    <div
      id="quick-actions-panel"
      className="rounded-xl p-6"
      style={{
        background: "var(--surface-raised)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div className="flex items-center gap-2 mb-4">
        <BoltRoundedIcon sx={{ fontSize: 18, color: "var(--primary)" }} />
        <h3
          className="text-sm font-semibold"
          style={{ color: "var(--text-secondary)" }}
        >
          Quick Actions
        </h3>
      </div>

      <div className="flex flex-col gap-2">
        <Button
          id="quick-action-add-monitor"
          onClick={onAddMonitor}
          fullWidth
          startIcon={<AddRoundedIcon sx={{ color: "var(--primary)" }} />}
          sx={actionButtonSx}
        >
          Add New Monitor
        </Button>
        <Button
          id="quick-action-view-monitors"
          onClick={goToMonitors}
          fullWidth
          startIcon={<DnsRoundedIcon sx={{ color: "var(--text-secondary)" }} />}
          sx={actionButtonSx}
        >
          View All Monitors
        </Button>
        <Button
          id="quick-action-view-incidents"
          onClick={goToIncidents}
          fullWidth
          startIcon={
            <WarningAmberRoundedIcon sx={{ color: "var(--status-down)" }} />
          }
          sx={actionButtonSx}
        >
          View Incidents
        </Button>
      </div>
    </div>
  );
}

export default memo(QuickActionsPanel);
