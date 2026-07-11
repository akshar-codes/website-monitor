import React from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from "recharts";
import ChartTooltip from "./ChartTooltip";

const STATUS_COLORS = {
  up: "#10b981",
  down: "#ef4444",
  degraded: "#f59e0b",
  unknown: "#6b7280",
};

export default function StatusPieChart({ data = [] }) {
  const chartData = data.filter((d) => d.value > 0);

  if (!chartData.length) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-text-muted">No monitor data</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="45%"
          innerRadius={60}
          outerRadius={90}
          paddingAngle={3}
          dataKey="value"
        >
          {chartData.map((entry, i) => (
            <Cell
              key={i}
              fill={STATUS_COLORS[entry.name] || "#6b7280"}
              strokeWidth={0}
            />
          ))}
        </Pie>
        <Tooltip
          content={<ChartTooltip formatter={(v, name) => `${v} monitors`} />}
        />
        <Legend
          wrapperStyle={{ fontSize: 11, color: "#71717a", paddingTop: 8 }}
          iconType="circle"
          iconSize={7}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
