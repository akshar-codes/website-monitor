import { memo, useCallback, useEffect, useState } from "react";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import { formatDistanceToNow } from "date-fns";

function useLiveRelativeTime(timestamp) {
  const [, forceTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => forceTick((n) => n + 1), 15000);
    return () => window.clearInterval(id);
  }, []);

  if (!timestamp) return null;
  return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
}

function DashboardHeader({ lastUpdatedAt, onRefresh, onAddMonitor }) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const relativeUpdated = useLiveRelativeTime(lastUpdatedAt);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    onRefresh();
    window.setTimeout(() => setIsRefreshing(false), 600);
  }, [onRefresh]);

  return (
    <div
      id="dashboard-header"
      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
    >
      <div>
        <h1
          className="text-xl sm:text-2xl font-bold tracking-tight"
          style={{ color: "var(--text-primary)" }}
        >
          Dashboard
        </h1>
        <p
          className="text-sm mt-0.5 flex items-center gap-1.5 flex-wrap"
          style={{ color: "var(--text-tertiary)" }}
        >
          <span>Real-time overview of your monitored services</span>
          {relativeUpdated && (
            <>
              <span aria-hidden="true">·</span>
              <span>Updated {relativeUpdated}</span>
            </>
          )}
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
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
              borderRadius: "var(--radius-md)",
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
          id="dashboard-add-monitor-btn"
          variant="contained"
          startIcon={<AddRoundedIcon />}
          onClick={onAddMonitor}
          sx={{
            bgcolor: "var(--primary)",
            fontWeight: 600,
            fontSize: "0.85rem",
            px: 2.5,
            boxShadow: "none",
            "&:hover": {
              bgcolor: "var(--primary-hover)",
              boxShadow: "var(--shadow-sm)",
            },
          }}
        >
          Add Monitor
        </Button>
      </div>
    </div>
  );
}

export default memo(DashboardHeader);
