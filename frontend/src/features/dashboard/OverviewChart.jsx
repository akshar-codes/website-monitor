import React, { useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import ChartTooltip from "../../components/charts/ChartTooltip";
import { formatChartDate, formatResponseTime } from "../../utils/format";
import { Skeleton } from "../../components/ui/Skeleton";
import EmptyState from "../../components/ui/EmptyState";
import { BarChart3 } from "lucide-react";

const WINDOWS = [
  { label: "24h", value: "24h" },
  { label: "7d", value: "7d" },
  { label: "30d", value: "30d" },
];

function WindowBtn({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-all ${
        active
          ? "bg-bg-subtle text-white"
          : "text-text-muted hover:text-text-secondary"
      }`}
    >
      {label}
    </button>
  );
}

export default function OverviewChart({ data: allData = {}, loading = false }) {
  const [window, setWindow] = useState("24h");

  const data = allData[window] || [];

  return (
    <div className="rounded-xl border border-border-subtle bg-bg-surface p-6">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-white">
            Response Time & Uptime
          </p>
          <p className="text-xs text-text-muted mt-0.5">
            System-wide performance overview
          </p>
        </div>
        <div className="flex items-center gap-0.5 rounded-lg border border-border-default bg-bg-elevated p-0.5">
          {WINDOWS.map((w) => (
            <WindowBtn
              key={w.value}
              label={w.label}
              active={window === w.value}
              onClick={() => setWindow(w.value)}
            />
          ))}
        </div>
      </div>

      <div style={{ height: 280 }}>
        {loading ? (
          <div className="flex h-full items-end gap-2 pb-6">
            {Array.from({ length: 14 }).map((_, i) => (
              <div
                key={i}
                className="flex-1 rounded-sm animate-pulse bg-bg-overlay"
                style={{ height: `${25 + Math.random() * 65}%` }}
              />
            ))}
          </div>
        ) : !data.length ? (
          <EmptyState
            icon={BarChart3}
            title="No data for this window"
            description="Check back once monitors have been polled."
          />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={data}
              margin={{ top: 4, right: 4, left: -16, bottom: 0 }}
            >
              <defs>
                <linearGradient id="rtFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.12} />
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
                yAxisId="rt"
                orientation="left"
                tickFormatter={(v) => `${v}ms`}
                tick={{ fill: "#52525b", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickMargin={4}
                width={52}
              />
              <YAxis
                yAxisId="up"
                orientation="right"
                tickFormatter={(v) => `${v}%`}
                tick={{ fill: "#52525b", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickMargin={4}
                width={40}
                domain={[0, 100]}
              />
              <Tooltip
                content={
                  <ChartTooltip
                    labelFormatter={(v) => formatChartDate(v, window)}
                    formatter={(v, name) =>
                      name === "Avg Response"
                        ? formatResponseTime(v)
                        : `${v.toFixed(1)}%`
                    }
                  />
                }
              />
              <Legend
                wrapperStyle={{
                  fontSize: 11,
                  color: "#71717a",
                  paddingTop: 12,
                }}
                iconType="circle"
                iconSize={7}
              />
              <Bar
                yAxisId="up"
                dataKey="uptimePercentage"
                name="Uptime"
                fill="#10b981"
                fillOpacity={0.15}
                radius={[3, 3, 0, 0]}
                barSize={14}
              />
              <Line
                yAxisId="rt"
                type="monotone"
                dataKey="avgResponseTime"
                name="Avg Response"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: "#10b981", strokeWidth: 0 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
