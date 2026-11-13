import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { formatPercentage, formatBudgetDuration } from "../../utils/sloFormat";
import { formatDateTime } from "../../utils/format";

export default function SloHistoryChart({
  snapshots = [],
  target = 99.9,
  deployments = [],
}) {
  if (!snapshots || snapshots.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center border border-dashed border-slate-200 rounded-xl text-xs text-slate-400">
        <span>No historical evaluation snapshots recorded yet.</span>
        <span className="mt-1 text-[11px] text-slate-500">
          Run an on-demand evaluation or wait for the scheduled background
          evaluator.
        </span>
      </div>
    );
  }

  // Format and sort chronologically (oldest to newest)
  const chartData = [...snapshots]
    .sort(
      (a, b) =>
        new Date(a.windowEnd || a.evaluatedAt) -
        new Date(b.windowEnd || b.evaluatedAt),
    )
    .map((s) => {
      const date = new Date(s.windowEnd || s.evaluatedAt);
      return {
        timestamp: date.getTime(),
        dateLabel: date.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        }),
        sli: Number(s.sliPercentage != null ? s.sliPercentage.toFixed(3) : 0),
        target: Number(target),
        remainingBudget: s.remainingBudgetSeconds,
        coverage: s.dataCoveragePercentage,
        consumed: s.consumedBudgetSeconds,
      };
    });

  // Calculate domain min around target and min sli
  const allSli = chartData.map((d) => d.sli);
  const minVal = Math.max(0, Math.min(...allSli, target) - 0.5);
  const maxVal = 100;

  // Map relevant deployments that fall in the timeline.
  // Enforce a maximum snap distance: a deployment will only be pinned to a
  // snapshot if it is within half the median interval, capped at 30 minutes.
  // Sparse snapshots therefore cannot pull a release marker arbitrarily far
  // from its actual deployment time.
  const medianIntervalMs = (() => {
    if (chartData.length < 2) return 30 * 60 * 1000;
    const gaps = [];
    for (let i = 1; i < chartData.length; i++) {
      gaps.push(chartData[i].timestamp - chartData[i - 1].timestamp);
    }
    gaps.sort((a, b) => a - b);
    return gaps[Math.floor(gaps.length / 2)];
  })();
  const MAX_SNAP_DISTANCE_MS = Math.min(medianIntervalMs / 2, 30 * 60 * 1000);

  const relevantDeployments = (deployments || [])
    .filter((dep) => {
      if (!dep.deployedAt || chartData.length === 0) return false;
      const depTime = new Date(dep.deployedAt).getTime();
      const firstTime = chartData[0].timestamp;
      const lastTime = chartData[chartData.length - 1].timestamp;
      return (
        depTime >= firstTime - 15 * 60 * 1000 &&
        depTime <= lastTime + 15 * 60 * 1000
      );
    })
    .map((dep) => {
      const depTime = new Date(dep.deployedAt).getTime();
      let closestPoint = chartData[0];
      let minDiff = Math.abs(chartData[0].timestamp - depTime);
      for (const pt of chartData) {
        const diff = Math.abs(pt.timestamp - depTime);
        if (diff < minDiff) {
          minDiff = diff;
          closestPoint = pt;
        }
      }
      // Drop markers that are too far from any data point to be meaningful
      if (minDiff > MAX_SNAP_DISTANCE_MS) return null;
      return {
        ...dep,
        closestDateLabel: closestPoint.dateLabel,
        actualDeployedAt: dep.deployedAt,
        snapOffsetMs: minDiff,
      };
    })
    .filter(Boolean);

  return (
    <div className="w-full h-72">
      <ul className="sr-only" aria-label="Deployment release markers">
        {relevantDeployments.map((dep, idx) => (
          <li key={dep.id || dep._id || `deployment-marker-${idx}`}>
            {dep.version} deployed at{" "}
            {formatDateTime(new Date(dep.actualDeployedAt).getTime())}
          </li>
        ))}
      </ul>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData}
          margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="sliGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="#e2e8f0"
          />
          <XAxis
            dataKey="dateLabel"
            tick={{ fontSize: 11, fill: "#64748b" }}
            axisLine={{ stroke: "#cbd5e1" }}
            tickLine={false}
          />
          <YAxis
            domain={[Math.floor(minVal), maxVal]}
            tick={{ fontSize: 11, fill: "#64748b" }}
            axisLine={{ stroke: "#cbd5e1" }}
            tickLine={false}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload;
                return (
                  <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-lg text-xs space-y-1">
                    <b className="text-slate-800 block">
                      {formatDateTime(data.timestamp)}
                    </b>
                    <div className="flex justify-between gap-4">
                      <span className="text-slate-500">Current SLI:</span>
                      <span className="font-semibold text-emerald-600">
                        {formatPercentage(data.sli, 3)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-slate-500">Target:</span>
                      <span className="font-semibold text-slate-700">
                        {formatPercentage(data.target, 2)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-slate-500">Budget Remaining:</span>
                      <span className="font-semibold text-slate-700">
                        {formatBudgetDuration(data.remainingBudget)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-slate-500">Coverage:</span>
                      <span className="font-semibold text-slate-700">
                        {formatPercentage(data.coverage, 1)}
                      </span>
                    </div>
                  </div>
                );
              }
              return null;
            }}
          />
          <ReferenceLine
            y={target}
            stroke="#f43f5e"
            strokeDasharray="4 4"
            label={{
              value: `Target: ${target}%`,
              position: "insideTopRight",
              fill: "#f43f5e",
              fontSize: 11,
              fontWeight: 600,
            }}
          />
          {relevantDeployments.map((dep, idx) => (
            <ReferenceLine
              key={dep.id || dep._id || `dep-${idx}`}
              x={dep.closestDateLabel}
              stroke="#8b5cf6"
              strokeDasharray="4 4"
              strokeWidth={2}
              label={{
                value: `🚀 ${dep.version}`,
                position: "insideTopLeft",
                fill: "#7c3aed",
                fontSize: 10,
                fontWeight: 600,
              }}
              ifOverflow="extendDomain"
            >
              <title>{`${dep.version} deployed at ${formatDateTime(new Date(dep.actualDeployedAt).getTime())}${dep.snapOffsetMs > 60000 ? ` (~${Math.round(dep.snapOffsetMs / 60000)}m offset from nearest snapshot)` : ""}`}</title>
            </ReferenceLine>
          ))}
          <Area
            type="monotone"
            dataKey="sli"
            stroke="#10b981"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#sliGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
