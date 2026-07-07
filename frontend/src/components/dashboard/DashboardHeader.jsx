import { memo, useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DnsRoundedIcon from "@mui/icons-material/DnsRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import { formatDistanceToNow, format } from "date-fns";

function useLiveClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 15000);
    return () => window.clearInterval(id);
  }, []);

  return now;
}

const outlinePillSx = {
  borderColor: "var(--border)",
  color: "var(--text-secondary)",
  fontWeight: 600,
  fontSize: "0.8125rem",
  borderRadius: "var(--radius-full)",
  px: 2.25,
  height: 38,
  "&:hover": {
    borderColor: "var(--primary)",
    color: "var(--primary)",
    bgcolor: "var(--primary-light)",
  },
};

function DashboardHeader({ lastUpdatedAt, onRefresh, onAddMonitor }) {
  const navigate = useNavigate();
  const now = useLiveClock();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const relativeUpdated = lastUpdatedAt
    ? formatDistanceToNow(new Date(lastUpdatedAt), { addSuffix: true })
    : null;

  const dateLabel = format(now, "EEEE, d MMMM yyyy").toUpperCase();

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    onRefresh();
    window.setTimeout(() => setIsRefreshing(false), 600);
  }, [onRefresh]);

  const goToMonitors = useCallback(() => navigate("/monitors"), [navigate]);
  const goToIncidents = useCallback(() => navigate("/incidents"), [navigate]);

  return (
    <div id="dashboard-header" className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <span className="u-eyebrow">
            {dateLabel}
            {relativeUpdated && (
              <>
                <span aria-hidden="true"> · </span>
                <span style={{ color: "var(--text-tertiary)" }}>
                  Updated {relativeUpdated}
                </span>
              </>
            )}
          </span>
          <h1
            className="text-2xl sm:text-3xl font-extrabold tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            Dashboard
          </h1>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <Tooltip title="Refresh dashboard" arrow>
            <IconButton
              id="dashboard-refresh-btn"
              onClick={handleRefresh}
              size="small"
              aria-label="Refresh dashboard"
              sx={{
                width: 38,
                height: 38,
                color: "var(--text-secondary)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-full)",
                "&:hover": {
                  borderColor: "var(--border-hover)",
                  bgcolor: "var(--surface-raised)",
                },
              }}
            >
              <RefreshRoundedIcon
                sx={{
                  fontSize: 18,
                  animation: isRefreshing ? "spin 0.6s linear" : "none",
                }}
              />
            </IconButton>
          </Tooltip>

          <Button
            id="dashboard-view-incidents-btn"
            onClick={goToIncidents}
            variant="outlined"
            startIcon={<WarningAmberRoundedIcon sx={{ fontSize: 16 }} />}
            sx={outlinePillSx}
          >
            Incidents
          </Button>

          <Button
            id="dashboard-view-monitors-btn"
            onClick={goToMonitors}
            variant="outlined"
            startIcon={<DnsRoundedIcon sx={{ fontSize: 16 }} />}
            sx={outlinePillSx}
          >
            Monitors
          </Button>

          <Button
            id="dashboard-add-monitor-btn"
            variant="contained"
            startIcon={<AddRoundedIcon />}
            onClick={onAddMonitor}
            sx={{
              bgcolor: "var(--primary)",
              fontWeight: 600,
              fontSize: "0.8125rem",
              borderRadius: "var(--radius-full)",
              px: 2.75,
              height: 38,
              boxShadow: "var(--shadow-glow-primary-sm)",
              "&:hover": {
                bgcolor: "var(--primary-hover)",
                boxShadow: "var(--shadow-glow-primary)",
              },
            }}
          >
            Add Monitor
          </Button>
        </div>
      </div>
    </div>
  );
}

export default memo(DashboardHeader);
