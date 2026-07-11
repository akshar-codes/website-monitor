import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import ChartTooltip from "./ChartTooltip";
import { formatChartDate, formatResponseTime } from "../../utils/format";
import EmptyState from "../ui/EmptyState";
import { BarChart3 } from "lucide-react";

export default function ResponseTimeChart({ data = [], window = "24h" }) {
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
      <AreaChart
        data={data}
        margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
      >
        <defs>
          <linearGradient id="rtGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
        </defs>
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
        <Area
          type="monotone"
          dataKey="avgResponseTime"
          name="Avg Response"
          stroke="#10b981"
          strokeWidth={2}
          fill="url(#rtGradient)"
          dot={false}
          activeDot={{ r: 4, fill: "#10b981", strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
