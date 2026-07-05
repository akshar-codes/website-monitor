import { memo, useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { formatNumber, formatPercentage } from "../../utils/formatters";

function SystemUptimeGauge({ data }) {
  const percentage = data?.percentage ?? 0;
  const window = data?.window || "24h";
  const totalChecks = data?.totalChecks ?? 0;

  const windowLabel = useMemo(() => {
    if (window === "24h") return "Last 24 hours";
    if (window === "7d") return "Last 7 days";
    if (window === "30d") return "Last 30 days";
    return `Last ${window}`;
  }, [window]);

  const gaugeData = useMemo(
    () => [
      { name: "uptime", value: percentage },
      { name: "downtime", value: 100 - percentage },
    ],
    [percentage],
  );

  const uptimeColor = useMemo(() => {
    if (percentage >= 99.5) return "var(--status-up)";
    if (percentage >= 95) return "var(--status-degraded)";
    return "var(--status-down)";
  }, [percentage]);

  return (
    <div
      id="system-uptime-gauge"
      className="rounded-xl p-5"
      style={{
        backgroundColor: "var(--surface-raised)",
        border: "1px solid var(--border)",
      }}
    >
      <h3
        className="text-sm font-semibold mb-2"
        style={{ color: "var(--text-secondary)" }}
      >
        System Uptime
      </h3>

      <div className="flex flex-col items-center">
        {/* Gauge ring */}
        <div className="relative" style={{ width: 160, height: 160 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={gaugeData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={72}
                startAngle={90}
                endAngle={-270}
                paddingAngle={0}
                dataKey="value"
                stroke="none"
                cornerRadius={6}
              >
                <Cell fill={uptimeColor} />
                <Cell fill="var(--border)" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className="text-2xl font-bold tracking-tight"
              style={{ color: "var(--text-primary)" }}
            >
              {formatPercentage(percentage, percentage >= 99 ? 2 : 1)}
            </span>
          </div>
        </div>

        {/* Labels */}
        <div className="flex flex-col items-center gap-1 mt-2">
          <span
            className="text-xs font-medium"
            style={{ color: "var(--text-tertiary)" }}
          >
            {windowLabel}
          </span>
          <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
            {formatNumber(totalChecks)} checks performed
          </span>
        </div>
      </div>
    </div>
  );
}

export default memo(SystemUptimeGauge);
