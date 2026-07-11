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
import ChartTooltip from "./ChartTooltip";
import { formatChartDate } from "../../utils/format";
import EmptyState from "../ui/EmptyState";
import { TrendingUp } from "lucide-react";

const LINE_COLORS = [
  "#10b981", // emerald
  "#3b82f6", // blue
  "#f59e0b", // amber
  "#a855f7", // purple
  "#ec4899", // pink
];

export default function TrendLineChart({
  data = [],
  lines = [],
  window = "30d",
  formatter,
}) {
  if (!data.length) {
    return (
      <EmptyState
        icon={TrendingUp}
        title="No trend data"
        description="Add monitors and wait for checks to build trend data."
      />
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={data}
        margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
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
          tick={{ fill: "#52525b", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickMargin={4}
          width={50}
          tickFormatter={formatter}
        />
        <Tooltip
          content={
            <ChartTooltip
              labelFormatter={(v) => formatChartDate(v, window)}
              formatter={formatter ? (v) => formatter(v) : undefined}
            />
          }
        />
        <Legend
          wrapperStyle={{ fontSize: 11, color: "#71717a", paddingTop: 12 }}
          iconType="circle"
          iconSize={7}
        />
        {lines.map((line, i) => (
          <Line
            key={line.key}
            type="monotone"
            dataKey={line.key}
            name={line.label}
            stroke={LINE_COLORS[i % LINE_COLORS.length]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
