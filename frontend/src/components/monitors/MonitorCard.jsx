import { memo, useCallback } from "react";
import Checkbox from "@mui/material/Checkbox";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import ToggleOnRoundedIcon from "@mui/icons-material/ToggleOnRounded";
import ToggleOffRoundedIcon from "@mui/icons-material/ToggleOffRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import { useNavigate } from "react-router-dom";
import RelativeTime from "../shared/RelativeTime";
import { truncateUrl, formatInterval } from "../../utils/formatters";

const iconBtnSx = {
  width: 32,
  height: 32,
  color: "var(--text-tertiary)",
  "&:hover": {
    bgcolor: "var(--surface)",
    color: "var(--text-secondary)",
  },
};

function MonitorCard({
  monitor,
  selected,
  onSelect,
  onEdit,
  onDelete,
  onToggleActive,
}) {
  const navigate = useNavigate();

  const handleCardClick = useCallback(
    (e) => {
      // Don't navigate if clicking on interactive elements
      if (
        e.target.closest("button") ||
        e.target.closest("input") ||
        e.target.closest(".MuiCheckbox-root")
      ) {
        return;
      }
      navigate(`/monitors/${monitor._id}`);
    },
    [navigate, monitor._id],
  );

  const handleSelect = useCallback(
    (e) => {
      e.stopPropagation();
      onSelect(monitor._id);
    },
    [onSelect, monitor._id],
  );

  const handleEdit = useCallback(
    (e) => {
      e.stopPropagation();
      onEdit(monitor);
    },
    [onEdit, monitor],
  );

  const handleDelete = useCallback(
    (e) => {
      e.stopPropagation();
      onDelete(monitor);
    },
    [onDelete, monitor],
  );

  const handleToggle = useCallback(
    (e) => {
      e.stopPropagation();
      onToggleActive(monitor);
    },
    [onToggleActive, monitor],
  );

  return (
    <div
      id={`monitor-card-${monitor._id}`}
      className="rounded-xl cursor-pointer group"
      style={{
        backgroundColor: "var(--surface-raised)",
        border: `1px solid ${selected ? "var(--primary)" : "var(--border)"}`,
        boxShadow: "var(--shadow-sm)",
        transition: "all var(--transition-base)",
      }}
      onClick={handleCardClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = "var(--shadow-md)";
        e.currentTarget.style.borderColor = selected
          ? "var(--primary)"
          : "var(--border-hover)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "var(--shadow-sm)";
        e.currentTarget.style.borderColor = selected
          ? "var(--primary)"
          : "var(--border)";
      }}
    >
      <div className="p-4">
        {/* Top row: checkbox + name + active dot */}
        <div className="flex items-start gap-2.5 mb-3">
          <Checkbox
            checked={selected}
            onChange={handleSelect}
            size="small"
            sx={{
              color: "var(--border)",
              padding: "2px",
              "&.Mui-checked": { color: "var(--primary)" },
            }}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4
                className="text-sm font-semibold truncate"
                style={{ color: "var(--text-primary)" }}
              >
                {monitor.name}
              </h4>
              <span
                className="shrink-0"
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "var(--radius-full)",
                  backgroundColor: monitor.active
                    ? "var(--status-up)"
                    : "var(--text-tertiary)",
                  display: "inline-block",
                }}
              />
            </div>
            <p
              className="text-xs mt-0.5 truncate"
              style={{ color: "var(--text-tertiary)" }}
            >
              {truncateUrl(monitor.url, 50)}
            </p>
          </div>
        </div>

        {/* Info row */}
        <div className="flex items-center gap-4 mb-3 ml-7">
          <span
            className="text-xs font-medium px-2 py-0.5 rounded-md"
            style={{
              backgroundColor: "var(--primary-light)",
              color: "var(--primary)",
            }}
          >
            {formatInterval(monitor.interval)}
          </span>

          <RelativeTime date={monitor.lastCheckedAt} className="text-xs!" />

          {monitor.consecutiveFailures > 0 && (
            <Tooltip
              title={`${monitor.consecutiveFailures} consecutive failures`}
              arrow
            >
              <span
                className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md"
                style={{
                  backgroundColor: "var(--status-down-bg)",
                  color: "var(--status-down)",
                }}
              >
                <WarningAmberRoundedIcon sx={{ fontSize: 12 }} />
                {monitor.consecutiveFailures}
              </span>
            </Tooltip>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 ml-6">
          <Tooltip title="Edit" arrow>
            <IconButton
              id={`monitor-edit-${monitor._id}`}
              onClick={handleEdit}
              size="small"
              sx={iconBtnSx}
            >
              <EditRoundedIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete" arrow>
            <IconButton
              id={`monitor-delete-${monitor._id}`}
              onClick={handleDelete}
              size="small"
              sx={{
                ...iconBtnSx,
                "&:hover": {
                  bgcolor: "var(--status-down-bg)",
                  color: "var(--status-down)",
                },
              }}
            >
              <DeleteRoundedIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title={monitor.active ? "Pause" : "Resume"} arrow>
            <IconButton
              id={`monitor-toggle-${monitor._id}`}
              onClick={handleToggle}
              size="small"
              sx={{
                ...iconBtnSx,
                "&:hover": {
                  bgcolor: monitor.active
                    ? "var(--status-degraded-bg)"
                    : "var(--status-up-bg)",
                  color: monitor.active
                    ? "var(--status-degraded)"
                    : "var(--status-up)",
                },
              }}
            >
              {monitor.active ? (
                <ToggleOnRoundedIcon
                  sx={{ fontSize: 20, color: "var(--status-up)" }}
                />
              ) : (
                <ToggleOffRoundedIcon sx={{ fontSize: 20 }} />
              )}
            </IconButton>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}

export default memo(MonitorCard);
