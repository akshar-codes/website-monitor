import { memo, useMemo } from "react";
import Tooltip from "@mui/material/Tooltip";
import { formatRelativeTime, formatDateTime } from "../../utils/formatters";

function RelativeTime({ date, className = "" }) {
  const relativeText = useMemo(() => formatRelativeTime(date), [date]);
  const fullDateTime = useMemo(() => formatDateTime(date), [date]);

  if (!date) {
    return <span className={`text-(--text-tertiary) ${className}`}>—</span>;
  }

  return (
    <Tooltip
      title={fullDateTime}
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
      <time
        dateTime={new Date(date).toISOString()}
        className={`cursor-default text-(--text-secondary) ${className}`}
        style={{ borderBottom: "1px dotted var(--border-hover)" }}
      >
        {relativeText}
      </time>
    </Tooltip>
  );
}

export default memo(RelativeTime);
