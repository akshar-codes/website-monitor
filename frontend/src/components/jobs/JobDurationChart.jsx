import { useMemo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { formatExecutionDuration } from "../../utils/jobFormat.js";
import { format, parseISO } from "date-fns";

export default function JobDurationChart({ runs = [] }) {
  // Filter runs that have a valid duration or completed timestamp
  const chartData = useMemo(() => {
    if (!runs || !runs.length) return [];

    // Chronological order (oldest to newest for time series)
    const sorted = [...runs].reverse();

    return sorted.map((run, idx) => {
      const timeVal = run.completedAt || run.startedAt || run.scheduledFor;
      let label = `#${idx + 1}`;
      if (timeVal) {
        try {
          const d =
            typeof timeVal === "string" ? parseISO(timeVal) : new Date(timeVal);
          label = format(d, "MMM d, HH:mm");
        } catch {
          label = `#${idx + 1}`;
        }
      }

      return {
        label,
        durationMs: run.durationMs ?? 0,
        status: run.status,
        runId: run.runId,
        exitCode: run.exitCode,
      };
    });
  }, [runs]);

  if (!chartData.length) {
    return (
      <div className="h-48 flex items-center justify-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
        No execution data available to chart yet.
      </div>
    );
  }

  return (
    <div className="w-full h-56 pt-2" data-testid="job-duration-chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData}
          margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
        >
          <defs>
            <linearGradient id="durationGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="#e2e8f0"
            opacity={0.6}
          />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: "#94a3b8" }}
            tickLine={false}
            axisLine={{ stroke: "#e2e8f0" }}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#94a3b8" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(val) => formatExecutionDuration(val)}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const data = payload[0].payload;
              return (
                <div className="p-2.5 rounded-lg bg-slate-900 text-white text-xs shadow-xl border border-slate-800 space-y-1">
                  <div className="font-semibold text-slate-200 flex items-center justify-between gap-3">
                    <span>{data.label}</span>
                    <span className="uppercase text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                      {data.status}
                    </span>
                  </div>
                  <div className="text-slate-300">
                    Duration:{" "}
                    <b className="text-emerald-400 font-mono">
                      {formatExecutionDuration(data.durationMs)}
                    </b>
                  </div>
                  {data.runId && (
                    <div className="text-[10px] text-slate-400 font-mono truncate max-w-50">
                      ID: {data.runId}
                    </div>
                  )}
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="durationMs"
            stroke="#10b981"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#durationGrad)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
