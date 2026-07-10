import React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import ChartTooltip from "../../components/charts/ChartTooltip";
import { formatChartDate, formatResponseTime } from "../../utils/format";
import EmptyState from "../../components/ui/EmptyState";
import { Clock } from "lucide-react";

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#a855f7", "#ec4899"];

/**
 * data: Array of { timestamp, [monitorId]: avgResponseTime }
 * monitors: Array of { id, name }
 */
export default function ResponseTimeTrendChart({
  data = [],
  monitors = [],
  window = "30d",
}) {
  if (!data.length || !monitors.length) {
    return (
      <EmptyState
        icon={Clock}
        title="No response time data"
        description="Response time trends will appear once monitors are active."
      />
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={data}
        margin={{ top: 4, right: 4, left: -16, bottom: 0 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="#1f1f23"
          vertical={false}
        />
        <XAxis
          dataKey="timestamp"
          tickFormatter={(v) => formatChartDate(v, window)}
          tick={{ fill: "#52525b", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickMargin={8}
          minTickGap={50}
        />
        <YAxis
          tickFormatter={(v) => `${v}ms`}
          tick={{ fill: "#52525b", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickMargin={4}
          width={52}
        />
        <Tooltip
          content={
            <ChartTooltip
              labelFormatter={(v) => formatChartDate(v, window)}
              formatter={(v) => formatResponseTime(v)}
            />
          }
        />
        <Legend
          wrapperStyle={{ fontSize: 11, color: "#71717a", paddingTop: 10 }}
          iconType="circle"
          iconSize={7}
        />
        {monitors.map((m, i) => (
          <Line
            key={m.id}
            type="monotone"
            dataKey={m.id}
            name={m.name}
            stroke={COLORS[i % COLORS.length]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
