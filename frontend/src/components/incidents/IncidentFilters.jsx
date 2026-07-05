import { memo } from "react";
import { ToggleButtonGroup, ToggleButton } from "@mui/material";

const statuses = [
  { value: "active", label: "All Active" },
  { value: "ongoing", label: "Ongoing" },
  { value: "investigating", label: "Investigating" },
  { value: "identified", label: "Identified" },
  { value: "resolved", label: "Resolved" },
];

const severities = [
  { value: "", label: "All" },
  { value: "critical", label: "Critical" },
  { value: "major", label: "Major" },
  { value: "minor", label: "Minor" },
];

const toggleGroupSx = {
  "& .MuiToggleButton-root": {
    fontFamily: "var(--font-sans)",
    textTransform: "none",
    fontSize: "0.8125rem",
    px: 2,
    py: 0.5,
    color: "var(--text-secondary)",
    borderColor: "var(--border)",
    "&.Mui-selected": {
      bgcolor: "var(--primary-light)",
      color: "var(--primary)",
      borderColor: "var(--primary)",
      "&:hover": { bgcolor: "var(--primary-light)" },
    },
  },
};

function IncidentFilters({ filters, onFilterChange }) {
  return (
    <div className="flex flex-wrap items-center gap-6 mb-4">
      {/* ── Status filter ── */}
      <div className="flex items-center gap-3">
        <span
          className="text-sm font-medium"
          style={{ color: "var(--text-secondary)" }}
        >
          Status:
        </span>
        <ToggleButtonGroup
          id="incident-status-filter"
          value={filters?.status || "active"}
          exclusive
          onChange={(_, val) => {
            if (val !== null) onFilterChange({ status: val, page: 1 });
          }}
          size="small"
          sx={toggleGroupSx}
        >
          {statuses.map((s) => (
            <ToggleButton key={s.value} value={s.value}>
              {s.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </div>

      {/* ── Severity filter ── */}
      <div className="flex items-center gap-3">
        <span
          className="text-sm font-medium"
          style={{ color: "var(--text-secondary)" }}
        >
          Severity:
        </span>
        <ToggleButtonGroup
          id="incident-severity-filter"
          value={filters?.severity || ""}
          exclusive
          onChange={(_, val) => {
            if (val !== null)
              onFilterChange({ severity: val || undefined, page: 1 });
          }}
          size="small"
          sx={toggleGroupSx}
        >
          {severities.map((s) => (
            <ToggleButton key={s.value} value={s.value}>
              {s.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </div>
    </div>
  );
}

export default memo(IncidentFilters);
