import { memo, useMemo } from "react";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import Tooltip from "@mui/material/Tooltip";
import { formatNumber } from "../../utils/formatters";

const SEGMENTS = [
  { key: "up", label: "Up", color: "var(--status-up)" },
  { key: "down", label: "Down", color: "var(--status-down)" },
  { key: "degraded", label: "Degraded", color: "var(--status-degraded)" },
  { key: "unknown", label: "Unknown", color: "var(--status-unknown)" },
];

function CurrentStatusBreakdown({ data }) {
  const { segments, total, allUp } = useMemo(() => {
    const up = data?.up ?? 0;
    const down = data?.down ?? 0;
    const degraded = data?.degraded ?? 0;
    const unknown = data?.unknown ?? 0;
    const t = up + down + degraded + unknown;
    const vals = { up, down, degraded, unknown };

    const segs = SEGMENTS.map((s) => ({
      ...s,
      count: vals[s.key],
      percentage: t > 0 ? (vals[s.key] / t) * 100 : 0,
    })).filter((s) => s.count > 0);

    return {
      segments: segs,
      total: t,
      allUp: down === 0 && degraded === 0 && unknown === 0 && up > 0,
    };
  }, [data]);

  if (total === 0) {
    return (
      <div
        id="current-status-breakdown"
        className="rounded-xl p-5"
        style={{
          backgroundColor: "var(--surface-raised)",
          border: "1px solid var(--border)",
        }}
      >
        <h3
          className="text-sm font-semibold mb-4"
          style={{ color: "var(--text-secondary)" }}
        >
          Current Status
        </h3>
        <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>
          No monitors configured yet.
        </p>
      </div>
    );
  }

  return (
    <div
      id="current-status-breakdown"
      className="rounded-xl p-5"
      style={{
        backgroundColor: "var(--surface-raised)",
        border: "1px solid var(--border)",
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3
          className="text-sm font-semibold"
          style={{ color: "var(--text-secondary)" }}
        >
          Current Status
        </h3>
        {allUp && (
          <span
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{
              backgroundColor: "var(--status-up-bg)",
              color: "var(--status-up)",
            }}
          >
            <CheckCircleRoundedIcon sx={{ fontSize: 14 }} />
            All Systems Operational
          </span>
        )}
      </div>

      {/* Segmented bar */}
      <div
        className="flex w-full overflow-hidden"
        style={{
          height: 12,
          borderRadius: "var(--radius-full)",
          backgroundColor: "var(--border)",
        }}
      >
        {segments.map((seg, i) => (
          <Tooltip
            key={seg.key}
            title={`${seg.label}: ${seg.count} (${seg.percentage.toFixed(1)}%)`}
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
                    "&::before": { border: "1px solid var(--border)" },
                  },
                },
              },
            }}
          >
            <div
              style={{
                width: `${seg.percentage}%`,
                backgroundColor: seg.color,
                minWidth: seg.count > 0 ? 4 : 0,
                transition: "width var(--transition-base)",
                borderRadius:
                  i === 0 && segments.length === 1
                    ? "var(--radius-full)"
                    : i === 0
                      ? "var(--radius-full) 0 0 var(--radius-full)"
                      : i === segments.length - 1
                        ? "0 var(--radius-full) var(--radius-full) 0"
                        : "0",
              }}
            />
          </Tooltip>
        ))}
      </div>

      {/* Labels */}
      <div className="flex flex-wrap gap-4 mt-3">
        {SEGMENTS.map((seg) => {
          const count = data?.[seg.key] ?? 0;
          return (
            <div key={seg.key} className="flex items-center gap-1.5">
              <span
                className="inline-block shrink-0"
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "var(--radius-full)",
                  backgroundColor: seg.color,
                }}
              />
              <span
                className="text-xs font-medium"
                style={{ color: "var(--text-secondary)" }}
              >
                {seg.label}
              </span>
              <span
                className="text-xs font-bold"
                style={{ color: "var(--text-primary)" }}
              >
                {formatNumber(count)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default memo(CurrentStatusBreakdown);
