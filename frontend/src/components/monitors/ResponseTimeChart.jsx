import { memo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  formatTime,
  formatDateTime,
  formatResponseTime,
} from "../../utils/formatters";
import { FAILURE_REASONS } from "../../utils/constants";

const STATUS_DOT_COLORS = {
  up: "#10b981",
  down: "#ef4444",
  degraded: "#f59e0b",
  unknown: "#6b7280",
};

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div
      className="rounded-lg p-3 text-xs shadow-lg"
      style={{
        background: "var(--surface-raised)",
        border: "1px solid var(--border)",
      }}
    >
      <div
        className="font-medium mb-1"
        style={{ color: "var(--text-primary)" }}
      >
        {formatDateTime(d.checkedAt)}
      </div>
      <div style={{ color: "var(--text-secondary)" }}>
        Response: <strong>{formatResponseTime(d.responseTime)}</strong>
      </div>
      <div style={{ color: "var(--text-secondary)" }}>
        Status:{" "}
        <span style={{ color: STATUS_DOT_COLORS[d.status] || "#6b7280" }}>
          {d.status}
        </span>
      </div>
      {d.httpStatus && (
        <div style={{ color: "var(--text-secondary)" }}>
          HTTP: {d.httpStatus}
        </div>
      )}
      {d.failureReason && (
        <div style={{ color: "var(--status-down)" }}>
          {FAILURE_REASONS[d.failureReason] || d.failureReason}
        </div>
      )}
    </div>
  );
}

function CustomDot({ cx, cy, payload }) {
  const color = STATUS_DOT_COLORS[payload?.status] || "#6b7280";
  return <circle cx={cx} cy={cy} r={4} fill={color} stroke="none" />;
}

function ResponseTimeChart({ checks }) {
  const data = (checks || []).slice().reverse();

  return (
    <div
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
        Response Time
      </h3>
      {data.length === 0 ? (
        <div
          className="flex items-center justify-center h-75 text-sm"
          style={{ color: "var(--text-tertiary)" }}
        >
          No check data available
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={350}>
          <LineChart
            data={data}
            margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="checkedAt"
              tickFormatter={formatTime}
              tick={{ fontSize: 11, fill: "var(--text-tertiary)" }}
              stroke="var(--border)"
            />
            <YAxis
              tick={{ fontSize: 11, fill: "var(--text-tertiary)" }}
              stroke="var(--border)"
              tickFormatter={(v) => `${v}ms`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="responseTime"
              stroke="var(--primary)"
              strokeWidth={2}
              dot={<CustomDot />}
              activeDot={{
                r: 6,
                stroke: "var(--primary)",
                strokeWidth: 2,
                fill: "var(--surface)",
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export default memo(ResponseTimeChart);
