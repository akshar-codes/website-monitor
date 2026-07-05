import { memo, useMemo } from "react";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import SpeedRoundedIcon from "@mui/icons-material/SpeedRounded";
import AnimatedNumber from "./AnimatedNumber";
import {
  formatTime,
  formatDateTime,
  formatResponseTime,
} from "../../utils/formatters";

function getSpeedColor(avg) {
  if (avg == null) return "var(--text-tertiary)";
  if (avg <= 200) return "var(--status-up)";
  if (avg <= 500) return "var(--status-degraded)";
  return "var(--status-down)";
}

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
        {d.monitorName}: <strong>{formatResponseTime(d.responseTime)}</strong>
      </div>
    </div>
  );
}

function ResponseTimeTrendCard({ recentChecks, responseTime }) {
  const average = responseTime?.average ?? null;
  const window = responseTime?.window || "24h";
  const speedColor = getSpeedColor(average);

  const chartData = useMemo(() => {
    const checks = recentChecks || [];
    return checks
      .slice()
      .reverse()
      .map((c) => ({
        checkedAt: c.checkedAt,
        responseTime: c.responseTime,
        monitorName: c.monitor?.name || "Unknown",
      }));
  }, [recentChecks]);

  const rangeStats = useMemo(() => {
    const times = chartData
      .map((d) => d.responseTime)
      .filter((v) => v != null && !Number.isNaN(v));
    if (times.length === 0) return null;
    return { min: Math.min(...times), max: Math.max(...times) };
  }, [chartData]);

  return (
    <div
      id="response-time-trend-card"
      className="rounded-xl p-6"
      style={{
        background: "var(--surface-raised)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div className="flex items-start justify-between mb-4 gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div
              className="flex items-center justify-center rounded-lg"
              style={{
                width: 32,
                height: 32,
                backgroundColor: "var(--primary-light)",
              }}
            >
              <SpeedRoundedIcon
                sx={{ fontSize: 18, color: "var(--primary)" }}
              />
            </div>
            <h3
              className="text-sm font-semibold"
              style={{ color: "var(--text-secondary)" }}
            >
              Response Time
            </h3>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span
              className="text-3xl font-bold tracking-tight"
              style={{ color: "var(--text-primary)" }}
            >
              {average != null ? (
                <AnimatedNumber value={average} decimals={0} />
              ) : (
                "—"
              )}
            </span>
            {average != null && (
              <span
                className="text-base font-medium"
                style={{ color: "var(--text-tertiary)" }}
              >
                ms avg
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
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
            Last {window}
          </span>
        </div>
      </div>

      {chartData.length === 0 ? (
        <div
          className="flex items-center justify-center h-[180px] text-sm"
          style={{ color: "var(--text-tertiary)" }}
        >
          No recent response time data
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart
            data={chartData}
            margin={{ top: 5, right: 10, bottom: 0, left: 0 }}
          >
            <defs>
              <linearGradient
                id="dashboardRtGradient"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor="var(--primary)"
                  stopOpacity={0.32}
                />
                <stop
                  offset="100%"
                  stopColor="var(--primary)"
                  stopOpacity={0.02}
                />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border)"
              vertical={false}
            />
            <XAxis
              dataKey="checkedAt"
              tickFormatter={formatTime}
              tick={{ fontSize: 10, fill: "var(--text-tertiary)" }}
              stroke="var(--border)"
              minTickGap={40}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "var(--text-tertiary)" }}
              stroke="var(--border)"
              tickFormatter={(v) => `${v}ms`}
              width={48}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ stroke: "var(--border-hover)", strokeDasharray: "4 4" }}
            />
            <Area
              type="monotone"
              dataKey="responseTime"
              stroke="var(--primary)"
              strokeWidth={2.5}
              fill="url(#dashboardRtGradient)"
              activeDot={{
                r: 4,
                stroke: "var(--primary)",
                strokeWidth: 2,
                fill: "var(--surface)",
              }}
              animationDuration={600}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}

      {rangeStats && (
        <div
          className="flex items-center justify-around mt-4 pt-4"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <div className="text-center">
            <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
              Fastest
            </p>
            <p
              className="text-sm font-semibold"
              style={{ color: "var(--status-up)" }}
            >
              {formatResponseTime(rangeStats.min)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
              Average
            </p>
            <p
              className="text-sm font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              {formatResponseTime(average)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
              Slowest
            </p>
            <p
              className="text-sm font-semibold"
              style={{ color: "var(--status-down)" }}
            >
              {formatResponseTime(rangeStats.max)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(ResponseTimeTrendCard);
