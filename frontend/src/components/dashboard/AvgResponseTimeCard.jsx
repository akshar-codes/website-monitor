import { memo, useMemo } from "react";
import SpeedRoundedIcon from "@mui/icons-material/SpeedRounded";
import { formatResponseTime } from "../../utils/formatters";

function AvgResponseTimeCard({ data }) {
  const average = data?.average ?? null;
  const window = data?.window || "24h";

  const windowLabel = useMemo(() => {
    if (window === "24h") return "Last 24 hours";
    if (window === "7d") return "Last 7 days";
    if (window === "30d") return "Last 30 days";
    return `Last ${window}`;
  }, [window]);

  const speedColor = useMemo(() => {
    if (average == null) return "var(--text-tertiary)";
    if (average <= 200) return "var(--status-up)";
    if (average <= 500) return "var(--status-degraded)";
    return "var(--status-down)";
  }, [average]);

  return (
    <div
      id="avg-response-time-card"
      className="rounded-xl p-5"
      style={{
        backgroundColor: "var(--surface-raised)",
        border: "1px solid var(--border)",
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <h3
          className="text-sm font-semibold"
          style={{ color: "var(--text-secondary)" }}
        >
          Avg Response Time
        </h3>
        <div
          className="flex items-center justify-center rounded-lg"
          style={{
            width: 36,
            height: 36,
            backgroundColor: "var(--primary-light)",
          }}
        >
          <SpeedRoundedIcon sx={{ fontSize: 20, color: "var(--primary)" }} />
        </div>
      </div>

      <div className="flex items-baseline gap-1.5">
        <span
          className="text-3xl font-bold tracking-tight"
          style={{ color: "var(--text-primary)" }}
        >
          {average != null ? Math.round(average) : "—"}
        </span>
        {average != null && (
          <span
            className="text-lg font-medium"
            style={{ color: "var(--text-tertiary)" }}
          >
            ms
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 mt-2">
        <span
          className="inline-block"
          style={{
            width: 8,
            height: 8,
            borderRadius: "var(--radius-full)",
            backgroundColor: speedColor,
          }}
        />
        <span
          className="text-xs font-medium"
          style={{ color: "var(--text-tertiary)" }}
        >
          {average != null ? formatResponseTime(average) : "No data"} ·{" "}
          {windowLabel}
        </span>
      </div>
    </div>
  );
}

export default memo(AvgResponseTimeCard);
