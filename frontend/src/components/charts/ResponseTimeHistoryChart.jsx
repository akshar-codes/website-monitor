import { memo, useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Skeleton } from "@mui/material";
import {
  formatTime,
  formatShortDate,
  formatResponseTime,
  formatDateTime,
} from "../../utils/formatters";

/* ──────────────────────── helpers ──────────────────────── */

const GRADIENT_ID_AVG = "rtAvgGradient";
const GRADIENT_ID_MAX = "rtMaxGradient";

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

const LEGEND_ITEMS = [
  { label: "Avg", color: "var(--primary)" },
  { label: "Min", color: "var(--status-up)" },
  { label: "Max", color: "#94a3b8" },
];

function CustomTooltip({ active, payload, labelFormatter }) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;

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

      {[
        { label: "Avg", value: d.avgResponseTime, color: "var(--primary)" },
        { label: "Min", value: d.minResponseTime, color: "var(--status-up)" },
        { label: "Max", value: d.maxResponseTime, color: "#94a3b8" },
      ].map((item) => (
        <div
          key={item.label}
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
                background: item.color,
                flexShrink: 0,
              }}
            />
            {item.label}
          </span>
          <span className="font-semibold" style={{ color: item.color }}>
            {formatResponseTime(item.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ──────────────────────── legend ──────────────────────── */

function CustomLegend() {
  return (
    <div className="flex items-center justify-center gap-5 mt-2">
      {LEGEND_ITEMS.map((item) => (
        <span
          key={item.label}
          className="flex items-center gap-1.5 text-xs"
          style={{ color: "var(--text-tertiary)" }}
        >
          <span
            style={{
              display: "inline-block",
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: item.color,
              flexShrink: 0,
            }}
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}

/* ──────────────────────── chart ──────────────────────── */

function ResponseTimeHistoryChart({ data, window, loading }) {
  const tickFormat = useTickFormatter(window);
  const tooltipDateFormat = useTooltipDateFormatter(window);

  /* ── loading ── */
  if (loading) {
    return (
      <div
        id="response-time-history-chart"
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
          Response Time History
        </h3>
        <Skeleton
          variant="rectangular"
          height={320}
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
        id="response-time-history-chart"
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
          Response Time History
        </h3>
        <div
          className="flex items-center justify-center h-80 text-sm"
          style={{ color: "var(--text-tertiary)" }}
        >
          No response time data available
        </div>
      </div>
    );
  }

  /* ── chart ── */
  return (
    <div
      id="response-time-history-chart"
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
        Response Time History
      </h3>

      <ResponsiveContainer width="100%" height={320}>
        <AreaChart
          data={points}
          margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
        >
          {/* ── gradients ── */}
          <defs>
            <linearGradient id={GRADIENT_ID_AVG} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id={GRADIENT_ID_MAX} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.12} />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
            </linearGradient>
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
            tickFormatter={(v) => `${v}ms`}
          />

          <Tooltip
            content={<CustomTooltip labelFormatter={tooltipDateFormat} />}
            cursor={{ stroke: "var(--border-hover)", strokeDasharray: "4 4" }}
          />

          {/* Max band — rendered first (behind) */}
          <Area
            type="monotone"
            dataKey="maxResponseTime"
            fill={`url(#${GRADIENT_ID_MAX})`}
            stroke="none"
            activeDot={false}
            animationDuration={800}
          />

          {/* Avg line — primary */}
          <Area
            type="monotone"
            dataKey="avgResponseTime"
            fill={`url(#${GRADIENT_ID_AVG})`}
            stroke="var(--primary)"
            strokeWidth={2.5}
            activeDot={{
              r: 5,
              stroke: "var(--primary)",
              strokeWidth: 2,
              fill: "var(--surface)",
            }}
            animationDuration={800}
          />

          {/* Min line — dashed cutout */}
          <Area
            type="monotone"
            dataKey="minResponseTime"
            fill="transparent"
            stroke="var(--status-up)"
            strokeWidth={1}
            strokeDasharray="4 3"
            activeDot={false}
            animationDuration={800}
          />

          <Legend content={<CustomLegend />} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default memo(ResponseTimeHistoryChart);
