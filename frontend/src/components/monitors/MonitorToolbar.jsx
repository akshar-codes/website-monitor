import { memo, useCallback } from "react";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Tooltip from "@mui/material/Tooltip";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ArrowUpwardRoundedIcon from "@mui/icons-material/ArrowUpwardRounded";
import ArrowDownwardRoundedIcon from "@mui/icons-material/ArrowDownwardRounded";
import PauseCircleRoundedIcon from "@mui/icons-material/PauseCircleRounded";
import PlayCircleRoundedIcon from "@mui/icons-material/PlayCircleRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { SORT_OPTIONS } from "../../utils/constants";

const toggleSx = {
  fontFamily: "var(--font-sans)",
  fontSize: "0.8rem",
  fontWeight: 500,
  textTransform: "none",
  color: "var(--text-secondary)",
  borderColor: "var(--border)",
  px: 2,
  py: 0.75,
  "&.Mui-selected": {
    backgroundColor: "var(--primary-light)",
    color: "var(--primary)",
    borderColor: "var(--primary)",
    "&:hover": {
      backgroundColor: "var(--primary-light)",
    },
  },
  "&:hover": {
    borderColor: "var(--border-hover)",
    backgroundColor: "var(--surface)",
  },
};

const selectSx = {
  fontFamily: "var(--font-sans)",
  fontSize: "0.8rem",
  fontWeight: 500,
  color: "var(--text-primary)",
  height: 38,
  "& .MuiOutlinedInput-notchedOutline": {
    borderColor: "var(--border)",
    borderRadius: "var(--radius-md)",
  },
  "&:hover .MuiOutlinedInput-notchedOutline": {
    borderColor: "var(--border-hover)",
  },
  "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
    borderColor: "var(--primary)",
  },
};

function MonitorToolbar({
  onCreateClick,
  filters,
  onFilterChange,
  selectedCount = 0,
  onBulkPause,
  onBulkResume,
  onBulkDelete,
}) {
  const handleActiveFilter = useCallback(
    (_event, value) => {
      if (value === null) return;
      onFilterChange({
        active: value === "all" ? undefined : value === "active",
        page: 1,
      });
    },
    [onFilterChange],
  );

  const handleSortChange = useCallback(
    (e) => {
      onFilterChange({ sortBy: e.target.value, page: 1 });
    },
    [onFilterChange],
  );

  const handleOrderToggle = useCallback(() => {
    onFilterChange({ order: filters.order === "asc" ? "desc" : "asc" });
  }, [filters.order, onFilterChange]);

  const activeValue =
    filters.active === undefined
      ? "all"
      : filters.active
        ? "active"
        : "inactive";

  // Bulk action bar
  if (selectedCount > 0) {
    return (
      <div
        id="monitor-toolbar-bulk"
        className="animate-slide-down flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl px-5 py-3"
        style={{
          backgroundColor: "var(--primary-light)",
          border: "1px solid var(--primary)",
        }}
      >
        <div className="flex items-center gap-3">
          <span
            className="text-sm font-semibold"
            style={{ color: "var(--primary)" }}
          >
            {selectedCount} selected
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            id="bulk-pause-btn"
            size="small"
            variant="outlined"
            startIcon={<PauseCircleRoundedIcon sx={{ fontSize: 16 }} />}
            onClick={onBulkPause}
            sx={{
              color: "var(--text-secondary)",
              borderColor: "var(--border)",
              fontSize: "0.8rem",
              fontWeight: 500,
              "&:hover": {
                borderColor: "var(--border-hover)",
                bgcolor: "var(--surface)",
              },
            }}
          >
            Pause
          </Button>
          <Button
            id="bulk-resume-btn"
            size="small"
            variant="outlined"
            startIcon={<PlayCircleRoundedIcon sx={{ fontSize: 16 }} />}
            onClick={onBulkResume}
            sx={{
              color: "var(--status-up)",
              borderColor: "var(--status-up)",
              fontSize: "0.8rem",
              fontWeight: 500,
              "&:hover": {
                borderColor: "var(--status-up)",
                bgcolor: "var(--status-up-bg)",
              },
            }}
          >
            Resume
          </Button>
          <Button
            id="bulk-delete-btn"
            size="small"
            variant="outlined"
            startIcon={<DeleteRoundedIcon sx={{ fontSize: 16 }} />}
            onClick={onBulkDelete}
            sx={{
              color: "var(--status-down)",
              borderColor: "var(--status-down)",
              fontSize: "0.8rem",
              fontWeight: 500,
              "&:hover": {
                borderColor: "var(--status-down)",
                bgcolor: "var(--status-down-bg)",
              },
            }}
          >
            Delete
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      id="monitor-toolbar"
      className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
    >
      {/* Left: Add button */}
      <Button
        id="add-monitor-btn"
        variant="contained"
        startIcon={<AddRoundedIcon />}
        onClick={onCreateClick}
        sx={{
          bgcolor: "var(--primary)",
          fontWeight: 600,
          fontSize: "0.85rem",
          px: 2.5,
          py: 1,
          boxShadow: "none",
          "&:hover": {
            bgcolor: "var(--primary-hover)",
            boxShadow: "var(--shadow-sm)",
          },
        }}
      >
        Add Monitor
      </Button>

      {/* Right: Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Active/Inactive filter */}
        <ToggleButtonGroup
          value={activeValue}
          exclusive
          onChange={handleActiveFilter}
          size="small"
          id="monitor-active-filter"
        >
          <ToggleButton value="all" sx={toggleSx}>
            All
          </ToggleButton>
          <ToggleButton value="active" sx={toggleSx}>
            Active
          </ToggleButton>
          <ToggleButton value="inactive" sx={toggleSx}>
            Inactive
          </ToggleButton>
        </ToggleButtonGroup>

        {/* Sort */}
        <Select
          id="monitor-sort-select"
          value={filters.sortBy || "createdAt"}
          onChange={handleSortChange}
          size="small"
          sx={{
            ...selectSx,
            minWidth: 140,
          }}
          MenuProps={{
            PaperProps: {
              sx: {
                bgcolor: "var(--surface-raised)",
                border: "1px solid var(--border)",
                boxShadow: "var(--shadow-lg)",
                "& .MuiMenuItem-root": {
                  fontFamily: "var(--font-sans)",
                  fontSize: "0.8rem",
                  color: "var(--text-primary)",
                  "&:hover": {
                    bgcolor: "var(--primary-light)",
                  },
                  "&.Mui-selected": {
                    bgcolor: "var(--primary-light)",
                    color: "var(--primary)",
                    fontWeight: 600,
                  },
                },
              },
            },
          }}
        >
          {SORT_OPTIONS.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>
              {opt.label}
            </MenuItem>
          ))}
        </Select>

        {/* Order toggle */}
        <Tooltip
          title={filters.order === "asc" ? "Ascending" : "Descending"}
          arrow
        >
          <IconButton
            id="monitor-order-toggle"
            size="small"
            onClick={handleOrderToggle}
            sx={{
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              color: "var(--text-secondary)",
              width: 38,
              height: 38,
              "&:hover": {
                borderColor: "var(--border-hover)",
                bgcolor: "var(--surface)",
              },
            }}
          >
            {filters.order === "asc" ? (
              <ArrowUpwardRoundedIcon sx={{ fontSize: 18 }} />
            ) : (
              <ArrowDownwardRoundedIcon sx={{ fontSize: 18 }} />
            )}
          </IconButton>
        </Tooltip>
      </div>
    </div>
  );
}

export default memo(MonitorToolbar);
