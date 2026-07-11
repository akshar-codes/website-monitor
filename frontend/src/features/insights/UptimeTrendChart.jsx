import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import ChartTooltip from "../../components/charts/ChartTooltip";
import { formatChartDate } from "../../utils/format";
import EmptyState from "../../components/ui/EmptyState";
import { TrendingUp } from "lucide-react";

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#a855f7", "#ec4899"];

/**
 * data: Array of { timestamp, [monitorId]: uptimePercentage }
 * monitors: Array of { id, name }
 */
export default function UptimeTrendChart({
  data = [],
  monitors = [],
  window = "30d",
}) {
  if (!data.length || !monitors.length) {
    return (
      <EmptyState
        icon={TrendingUp}
        title="No trend data available"
        description="Add monitors and wait for checks to populate trend data."
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
          {monitors.map((m, i) => (
            <linearGradient
              key={m.id}
              id={`grad-${m.id}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop
                offset="5%"
                stopColor={COLORS[i % COLORS.length]}
                stopOpacity={0.12}
              />
              <stop
                offset="95%"
                stopColor={COLORS[i % COLORS.length]}
                stopOpacity={0}
              />
            </linearGradient>
          ))}
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
          minTickGap={50}
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
              formatter={(v) => `${Number(v).toFixed(1)}%`}
            />
          }
        />
        <Legend
          wrapperStyle={{ fontSize: 11, color: "#71717a", paddingTop: 10 }}
          iconType="circle"
          iconSize={7}
        />
        {monitors.map((m, i) => (
          <Area
            key={m.id}
            type="monotone"
            dataKey={m.id}
            name={m.name}
            stroke={COLORS[i % COLORS.length]}
            strokeWidth={2}
            fill={`url(#grad-${m.id})`}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
