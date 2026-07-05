import { memo, useCallback } from "react";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";

const WINDOWS = [
  { value: "24h", label: "24h" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
];

function WindowSelector({ value, onChange }) {
  const handleChange = useCallback(
    (_event, newValue) => {
      // Prevent deselecting — always keep one selected
      if (newValue !== null) {
        onChange(newValue);
      }
    },
    [onChange],
  );

  return (
    <ToggleButtonGroup
      id="window-selector"
      value={value}
      exclusive
      onChange={handleChange}
      size="small"
      aria-label="Time window"
      sx={{
        "& .MuiToggleButtonGroup-grouped": {
          border: "1px solid var(--border)",
          fontFamily: "var(--font-sans)",
          fontWeight: 600,
          fontSize: "0.8rem",
          textTransform: "none",
          color: "var(--text-secondary)",
          px: 2,
          py: 0.5,
          minWidth: 48,
          transition: "all var(--transition-fast)",
          "&:hover": {
            bgcolor: "var(--primary-light)",
            color: "var(--primary)",
            borderColor: "var(--primary)",
          },
          "&.Mui-selected": {
            bgcolor: "var(--primary)",
            color: "#fff",
            borderColor: "var(--primary)",
            "&:hover": {
              bgcolor: "var(--primary-hover)",
            },
          },
          "&:not(:first-of-type)": {
            borderLeft: "1px solid var(--border)",
            marginLeft: 0,
          },
          "&:first-of-type": {
            borderRadius: "var(--radius-md) 0 0 var(--radius-md)",
          },
          "&:last-of-type": {
            borderRadius: "0 var(--radius-md) var(--radius-md) 0",
          },
        },
      }}
    >
      {WINDOWS.map(({ value: wVal, label }) => (
        <ToggleButton
          key={wVal}
          value={wVal}
          id={`window-btn-${wVal}`}
          aria-label={`${label} window`}
        >
          {label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}

export default memo(WindowSelector);
