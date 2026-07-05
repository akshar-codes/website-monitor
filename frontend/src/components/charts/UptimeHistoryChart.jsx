import { memo, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";
import { Skeleton } from "@mui/material";
import {
  formatTime,
  formatShortDate,
  formatPercentage,
  formatNumber,
  formatDateTime,
} from "../../utils/formatters";

/* ──────────────────────── helpers ──────────────────────── */

const SLA_THRESHOLD = 99.9;

function getBarColor(uptime) {
  if (uptime >= 99.5) return "var(--status-up)";
  if (uptime >= 95) return "var(--status-degraded)";
  return "var(--status-down)";
}

function useTickFormatter(window) {
  return useMemo(
    () => (window === "24h" ? formatTime : formatShortDate),
    [window],
  );
}

function useTooltipDateFormatter(window) {
  return useMemo(
    () => (window === "24h" ? formatDateTime : formatShortDate),
    [window],
  );
}

/* ──────────────────────── tooltip ──────────────────────── */

function CustomTooltip({ active, payload, labelFormatter }) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  const uptimeColor = getBarColor(d.uptimePercentage);

  return (
    <div
      className="rounded-lg p-3 text-xs shadow-lg"
      style={{
        background: "var(--surface-raised)",
        border: "1px solid var(--border)",
        minWidth: 180,
      }}
    >
      <div
        className="font-medium mb-2"
        style={{ color: "var(--text-primary)" }}
      >
        {labelFormatter ? labelFormatter(d.timestamp) : d.timestamp}
      </div>

      <div className="flex items-center justify-between gap-4 mb-1.5">
        <span style={{ color: "var(--text-secondary)" }}>Uptime</span>
        <span className="font-bold" style={{ color: uptimeColor }}>
          {formatPercentage(d.uptimePercentage)}
        </span>
      </div>

      <div
        className="pt-1.5 mt-1 border-t flex flex-col gap-0.5"
        style={{ borderColor: "var(--border)" }}
      >
        <div
          className="flex items-center justify-between gap-4"
          style={{ color: "var(--text-secondary)" }}
        >
          <span>Total checks</span>
          <span className="font-semibold">{formatNumber(d.totalChecks)}</span>
        </div>
        <div
          className="flex items-center justify-between gap-4"
          style={{ color: "var(--status-up)" }}
        >
          <span className="flex items-center gap-1.5">
            <span
              style={{
                display: "inline-block",
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "var(--status-up)",
              }}
            />
            Successful
          </span>
          <span>{formatNumber(d.successfulChecks)}</span>
        </div>
        <div
          className="flex items-center justify-between gap-4"
          style={{ color: "var(--status-down)" }}
        >
          <span className="flex items-center gap-1.5">
            <span
              style={{
                display: "inline-block",
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "var(--status-down)",
              }}
            />
            Failed
          </span>
          <span>{formatNumber(d.failedChecks)}</span>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────── chart ──────────────────────── */

function UptimeHistoryChart({ data, window, loading }) {
  const tickFormat = useTickFormatter(window);
  const tooltipDateFormat = useTooltipDateFormatter(window);

  /* ── loading ── */
  if (loading) {
    return (
      <div
        id="uptime-history-chart"
        className="rounded-xl p-6"
        style={{
          background: "var(--surface-raised)",
          border: "1px solid var(--border)",
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3
            className="text-sm font-semibold"
            style={{ color: "var(--text-secondary)" }}
          >
            Uptime History
          </h3>
        </div>
        <Skeleton
          variant="rectangular"
          height={280}
          sx={{ bgcolor: "var(--border)", borderRadius: "var(--radius-lg)" }}
        />
      </div>
    );
  }

  /* ── empty ── */
  const points = data ?? [];
  if (points.length === 0) {
    return (
      <div
        id="uptime-history-chart"
        className="rounded-xl p-6"
        style={{
          background: "var(--surface-raised)",
          border: "1px solid var(--border)",
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3
            className="text-sm font-semibold"
            style={{ color: "var(--text-secondary)" }}
          >
            Uptime History
          </h3>
        </div>
        <div
          className="flex items-center justify-center h-70 text-sm"
          style={{ color: "var(--text-tertiary)" }}
        >
          No uptime data available
        </div>
      </div>
    );
  }

  /* ── chart ── */
  return (
    <div
      id="uptime-history-chart"
      className="rounded-xl p-6"
      style={{
        background: "var(--surface-raised)",
        border: "1px solid var(--border)",
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3
          className="text-sm font-semibold"
          style={{ color: "var(--text-secondary)" }}
        >
          Uptime History
        </h3>
        <span
          className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
          style={{
            background: "var(--primary-light)",
            color: "var(--primary)",
            border: "1px solid var(--primary)",
            opacity: 0.85,
          }}
        >
          99.9% SLA
        </span>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <BarChart
          data={points}
          margin={{ top: 10, right: 20, bottom: 5, left: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border)"
            vertical={false}
          />

          <XAxis
            dataKey="timestamp"
            tickFormatter={tickFormat}
            tick={{ fontSize: 11, fill: "var(--text-tertiary)" }}
            stroke="var(--border)"
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: "var(--text-tertiary)" }}
            stroke="var(--border)"
            tickFormatter={(v) => `${v}%`}
          />

          <Tooltip
            content={<CustomTooltip labelFormatter={tooltipDateFormat} />}
            cursor={{ fill: "var(--border)", opacity: 0.3, radius: 4 }}
          />

          <ReferenceLine
            y={SLA_THRESHOLD}
            stroke="var(--primary)"
            strokeDasharray="6 4"
            strokeWidth={1.5}
            label={{
              value: "SLA 99.9%",
              position: "insideTopRight",
              fill: "var(--primary)",
              fontSize: 10,
              fontWeight: 600,
            }}
          />

          <Bar
            dataKey="uptimePercentage"
            radius={[4, 4, 0, 0]}
            animationDuration={600}
            maxBarSize={48}
          >
            {points.map((entry, idx) => (
              <Cell
                key={`cell-${idx}`}
                fill={getBarColor(entry.uptimePercentage)}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default memo(UptimeHistoryChart);
