import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";
import ChartTooltip from "./ChartTooltip";
import { formatChartDate } from "../../utils/format";
import EmptyState from "../ui/EmptyState";
import { BarChart3 } from "lucide-react";

export default function UptimeChart({ data = [], window = "24h" }) {
  if (!data.length) {
    return (
      <EmptyState
        icon={BarChart3}
        title="No data available"
        description="Check back once monitors have been polled."
      />
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
        barSize={16}
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
          minTickGap={40}
        />
        <YAxis
          tickFormatter={(v) => `${v}%`}
          tick={{ fill: "#52525b", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickMargin={4}
          width={44}
          domain={[0, 100]}
        />
        <Tooltip
          content={
            <ChartTooltip
              labelFormatter={(v) => formatChartDate(v, window)}
              formatter={(v) => `${v.toFixed(1)}%`}
            />
          }
        />
        <Bar dataKey="uptimePercentage" name="Uptime" radius={[3, 3, 0, 0]}>
          {data.map((entry, i) => (
            <Cell
              key={i}
              fill={
                entry.uptimePercentage >= 99
                  ? "#10b981"
                  : entry.uptimePercentage >= 95
                    ? "#f59e0b"
                    : "#ef4444"
              }
              fillOpacity={0.85}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
