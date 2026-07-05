import { memo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Table from "@mui/material/Table";
import TableHead from "@mui/material/TableHead";
import TableBody from "@mui/material/TableBody";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import Checkbox from "@mui/material/Checkbox";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import ToggleOnRoundedIcon from "@mui/icons-material/ToggleOnRounded";
import ToggleOffRoundedIcon from "@mui/icons-material/ToggleOffRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import MonitorCard from "./MonitorCard";
import RelativeTime from "../shared/RelativeTime";
import { truncateUrl, formatInterval } from "../../utils/formatters";

const cellSx = {
  fontFamily: "var(--font-sans)",
  fontSize: "0.8125rem",
  py: 1.5,
  px: 2,
  borderBottom: "1px solid var(--border)",
};

const headCellSx = {
  ...cellSx,
  color: "var(--text-secondary)",
  fontWeight: 600,
  fontSize: "0.75rem",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  backgroundColor: "var(--surface)",
};

const iconBtnSx = {
  width: 30,
  height: 30,
  color: "var(--text-tertiary)",
  "&:hover": {
    bgcolor: "var(--surface)",
    color: "var(--text-secondary)",
  },
};

function MonitorTableRow({
  monitor,
  selected,
  onToggleSelect,
  onEdit,
  onDelete,
  onToggleActive,
}) {
  const navigate = useNavigate();

  const handleRowClick = useCallback(
    (e) => {
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

  return (
    <TableRow
      id={`monitor-row-${monitor._id}`}
      onClick={handleRowClick}
      sx={{
        cursor: "pointer",
        transition: "background-color var(--transition-fast)",
        backgroundColor: selected ? "var(--primary-light)" : "transparent",
        "&:hover": {
          backgroundColor: selected ? "var(--primary-light)" : "var(--surface)",
        },
        "&:last-child td": {
          borderBottom: "none",
        },
      }}
    >
      {/* Checkbox */}
      <TableCell sx={{ ...cellSx, width: 48 }}>
        <Checkbox
          checked={selected}
          onChange={() => onToggleSelect(monitor._id)}
          size="small"
          sx={{
            color: "var(--border)",
            padding: "4px",
            "&.Mui-checked": { color: "var(--primary)" },
          }}
        />
      </TableCell>

      {/* Name */}
      <TableCell
        sx={{ ...cellSx, fontWeight: 600, color: "var(--text-primary)" }}
      >
        <span className="truncate block max-w-[200px]">{monitor.name}</span>
      </TableCell>

      {/* URL */}
      <TableCell sx={cellSx}>
        <span
          className="truncate block max-w-[260px] text-xs font-mono"
          style={{ color: "var(--text-tertiary)" }}
        >
          {truncateUrl(monitor.url, 45)}
        </span>
      </TableCell>

      {/* Active */}
      <TableCell sx={{ ...cellSx, width: 80 }}>
        <span
          className="inline-flex items-center gap-1.5 text-xs font-medium"
          style={{
            color: monitor.active ? "var(--status-up)" : "var(--text-tertiary)",
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "var(--radius-full)",
              backgroundColor: monitor.active
                ? "var(--status-up)"
                : "var(--text-tertiary)",
              display: "inline-block",
            }}
          />
          {monitor.active ? "Active" : "Inactive"}
        </span>
      </TableCell>

      {/* Interval */}
      <TableCell
        sx={{ ...cellSx, width: 100, fontVariantNumeric: "tabular-nums" }}
      >
        <span
          className="text-xs font-medium px-2 py-0.5 rounded-md inline-block"
          style={{
            backgroundColor: "var(--primary-light)",
            color: "var(--primary)",
          }}
        >
          {formatInterval(monitor.interval)}
        </span>
      </TableCell>

      {/* Last Checked */}
      <TableCell sx={{ ...cellSx, width: 140 }}>
        <RelativeTime date={monitor.lastCheckedAt} className="text-xs!" />
      </TableCell>

      {/* Failures */}
      <TableCell sx={{ ...cellSx, width: 90 }}>
        {monitor.consecutiveFailures > 0 ? (
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
        ) : (
          <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
            0
          </span>
        )}
      </TableCell>

      {/* Actions */}
      <TableCell sx={{ ...cellSx, width: 120 }}>
        <div className="flex items-center gap-0.5">
          <Tooltip title="Edit" arrow>
            <IconButton
              id={`table-edit-${monitor._id}`}
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(monitor);
              }}
              sx={iconBtnSx}
            >
              <EditRoundedIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete" arrow>
            <IconButton
              id={`table-delete-${monitor._id}`}
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(monitor);
              }}
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
              id={`table-toggle-${monitor._id}`}
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onToggleActive(monitor);
              }}
              sx={iconBtnSx}
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
      </TableCell>
    </TableRow>
  );
}

function MonitorList({
  monitors,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  isAllSelected,
  onEdit,
  onDelete,
  onToggleActive,
}) {
  if (!monitors || monitors.length === 0) return null;

  return (
    <>
      {/* Desktop: Table view */}
      <div
        className="hidden lg:block rounded-xl overflow-hidden"
        style={{
          backgroundColor: "var(--surface-raised)",
          border: "1px solid var(--border)",
        }}
      >
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ ...headCellSx, width: 48 }}>
                  <Checkbox
                    checked={isAllSelected}
                    indeterminate={selectedIds.size > 0 && !isAllSelected}
                    onChange={onSelectAll}
                    size="small"
                    sx={{
                      color: "var(--border)",
                      padding: "4px",
                      "&.Mui-checked": { color: "var(--primary)" },
                      "&.MuiCheckbox-indeterminate": {
                        color: "var(--primary)",
                      },
                    }}
                  />
                </TableCell>
                <TableCell sx={headCellSx}>Name</TableCell>
                <TableCell sx={headCellSx}>URL</TableCell>
                <TableCell sx={headCellSx}>Status</TableCell>
                <TableCell sx={headCellSx}>Interval</TableCell>
                <TableCell sx={headCellSx}>Last Checked</TableCell>
                <TableCell sx={headCellSx}>Failures</TableCell>
                <TableCell sx={headCellSx}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {monitors.map((monitor) => (
                <MonitorTableRow
                  key={monitor._id}
                  monitor={monitor}
                  selected={selectedIds.has(monitor._id)}
                  onToggleSelect={onToggleSelect}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onToggleActive={onToggleActive}
                />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </div>

      {/* Mobile: Card view */}
      <div className="lg:hidden grid grid-cols-1 sm:grid-cols-2 gap-4">
        {monitors.map((monitor) => (
          <MonitorCard
            key={monitor._id}
            monitor={monitor}
            selected={selectedIds.has(monitor._id)}
            onSelect={onToggleSelect}
            onEdit={onEdit}
            onDelete={onDelete}
            onToggleActive={onToggleActive}
          />
        ))}
      </div>
    </>
  );
}

export default memo(MonitorList);
