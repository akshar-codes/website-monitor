import { memo, useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Skeleton } from "@mui/material";
import {
  formatTime,
  formatShortDate,
  formatNumber,
  formatDateTime,
} from "../../utils/formatters";

/* ──────────────────────── constants ──────────────────────── */

const STATUS_SERIES = [
  {
    key: "unknownChecks",
    label: "Unknown",
    color: "#6b7280",
    gradientId: "stUnknown",
  },
  {
    key: "degradedChecks",
    label: "Degraded",
    color: "#f59e0b",
    gradientId: "stDegraded",
  },
  {
    key: "failedChecks",
    label: "Down",
    color: "#ef4444",
    gradientId: "stFailed",
  },
  {
    key: "successfulChecks",
    label: "Up",
    color: "#10b981",
    gradientId: "stSuccess",
  },
];

/* ──────────────────────── helpers ──────────────────────── */

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

  // Show series top-to-bottom: Up → Down → Degraded → Unknown
  const rows = [...STATUS_SERIES].reverse();

  return (
    <div
      className="rounded-lg p-3 text-xs shadow-lg"
      style={{
        background: "var(--surface-raised)",
        border: "1px solid var(--border)",
        minWidth: 170,
      }}
    >
      <div
        className="font-medium mb-2"
        style={{ color: "var(--text-primary)" }}
      >
        {labelFormatter ? labelFormatter(d.timestamp) : d.timestamp}
      </div>

      {rows.map((s) => (
        <div
          key={s.key}
          className="flex items-center justify-between gap-4 py-0.5"
          style={{ color: "var(--text-secondary)" }}
        >
          <span className="flex items-center gap-1.5">
            <span
              style={{
                display: "inline-block",
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: s.color,
                flexShrink: 0,
              }}
            />
            {s.label}
          </span>
          <span className="font-semibold">{formatNumber(d[s.key])}</span>
        </div>
      ))}

      <div
        className="flex items-center justify-between gap-4 pt-1.5 mt-1 border-t font-semibold"
        style={{
          color: "var(--text-primary)",
          borderColor: "var(--border)",
        }}
      >
        <span>Total</span>
        <span>{formatNumber(d.totalChecks)}</span>
      </div>
    </div>
  );
}

/* ──────────────────────── legend ──────────────────────── */

const LEGEND_DISPLAY = [...STATUS_SERIES].reverse(); // Up first

function CustomLegend() {
  return (
    <div className="flex items-center justify-center gap-5 mt-3">
      {LEGEND_DISPLAY.map((s) => (
        <span
          key={s.key}
          className="flex items-center gap-1.5 text-xs"
          style={{ color: "var(--text-tertiary)" }}
        >
          <span
            style={{
              display: "inline-block",
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: s.color,
              flexShrink: 0,
            }}
          />
          {s.label}
        </span>
      ))}
    </div>
  );
}

/* ──────────────────────── chart ──────────────────────── */

function StatusTrendChart({ data, window, loading }) {
  const tickFormat = useTickFormatter(window);
  const tooltipDateFormat = useTooltipDateFormatter(window);

  /* ── loading ── */
  if (loading) {
    return (
      <div
        id="status-trend-chart"
        className="rounded-xl p-6"
        style={{
          background: "var(--surface-raised)",
          border: "1px solid var(--border)",
        }}
      >
        <h3
          className="text-sm font-semibold mb-4"
          style={{ color: "var(--text-secondary)" }}
        >
          Status Trend
        </h3>
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
        id="status-trend-chart"
        className="rounded-xl p-6"
        style={{
          background: "var(--surface-raised)",
          border: "1px solid var(--border)",
        }}
      >
        <h3
          className="text-sm font-semibold mb-4"
          style={{ color: "var(--text-secondary)" }}
        >
          Status Trend
        </h3>
        <div
          className="flex items-center justify-center h-[280px] text-sm"
          style={{ color: "var(--text-tertiary)" }}
        >
          No status trend data available
        </div>
      </div>
    );
  }

  /* ── chart ── */
  return (
    <div
      id="status-trend-chart"
      className="rounded-xl p-6"
      style={{
        background: "var(--surface-raised)",
        border: "1px solid var(--border)",
      }}
    >
      <h3
        className="text-sm font-semibold mb-4"
        style={{ color: "var(--text-secondary)" }}
      >
        Status Trend
      </h3>

      <ResponsiveContainer width="100%" height={280}>
        <AreaChart
          data={points}
          margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
        >
          {/* ── gradient defs ── */}
          <defs>
            {STATUS_SERIES.map((s) => (
              <linearGradient
                key={s.gradientId}
                id={s.gradientId}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor={s.color} stopOpacity={0.6} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0.05} />
              </linearGradient>
            ))}
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />

          <XAxis
            dataKey="timestamp"
            tickFormatter={tickFormat}
            tick={{ fontSize: 11, fill: "var(--text-tertiary)" }}
            stroke="var(--border)"
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--text-tertiary)" }}
            stroke="var(--border)"
            allowDecimals={false}
          />

          <Tooltip
            content={<CustomTooltip labelFormatter={tooltipDateFormat} />}
            cursor={{ stroke: "var(--border-hover)", strokeDasharray: "4 4" }}
          />

          {/* Stacked areas — bottom-to-top render order */}
          {STATUS_SERIES.map((s, idx) => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              stackId="status"
              fill={`url(#${s.gradientId})`}
              stroke={s.color}
              strokeWidth={1.5}
              activeDot={{
                r: 4,
                fill: s.color,
                stroke: "#fff",
                strokeWidth: 1,
              }}
              animationDuration={800}
              animationBegin={idx * 100}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>

      <CustomLegend />
    </div>
  );
}

export default memo(StatusTrendChart);
