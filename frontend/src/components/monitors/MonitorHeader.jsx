import { memo } from "react";
import { Switch, Button, IconButton, Tooltip } from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import LaunchIcon from "@mui/icons-material/Launch";
import StatusBadge from "../shared/StatusBadge";
import RelativeTime from "../shared/RelativeTime";
import { formatInterval } from "../../utils/formatters";

function MonitorHeader({
  monitor,
  currentStatus,
  onEdit,
  onDelete,
  onToggleActive,
}) {
  if (!monitor) return null;

  return (
    <div
      className="rounded-xl p-6"
      style={{
        background: "var(--surface-raised)",
        border: "1px solid var(--border)",
      }}
    >
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h1
              className="text-2xl font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              {monitor.name}
            </h1>
            <StatusBadge status={currentStatus || "unknown"} />
          </div>
          <a
            href={monitor.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm mb-4 hover:underline"
            style={{ color: "var(--primary)" }}
            id="monitor-url-link"
          >
            {monitor.url}
            <LaunchIcon sx={{ fontSize: 14 }} />
          </a>
          <div
            className="flex flex-wrap gap-x-6 gap-y-2 text-sm"
            style={{ color: "var(--text-secondary)" }}
          >
            <div className="flex items-center gap-1.5">
              <span className="font-medium">Interval:</span>
              <span>{formatInterval(monitor.interval)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-medium">Last checked:</span>
              <RelativeTime date={monitor.lastCheckedAt} />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-medium">Next check:</span>
              <RelativeTime date={monitor.nextCheckAt} />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-medium">Active:</span>
              <Switch
                id="monitor-active-toggle"
                size="small"
                checked={monitor.active}
                onChange={() => onToggleActive?.()}
                color="success"
              />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            id="monitor-edit-btn"
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={onEdit}
            sx={{
              borderColor: "var(--border)",
              color: "var(--text-primary)",
              "&:hover": {
                borderColor: "var(--primary)",
                color: "var(--primary)",
              },
            }}
          >
            Edit
          </Button>
          <Tooltip title="Delete monitor">
            <IconButton
              id="monitor-delete-btn"
              onClick={onDelete}
              sx={{ color: "var(--status-down)" }}
            >
              <DeleteIcon />
            </IconButton>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}

export default memo(MonitorHeader);
