import { memo, useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import Tooltip from "@mui/material/Tooltip";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import { formatPercentage, formatNumber } from "../../utils/formatters";

const SEGMENTS = [
  { key: "up", label: "Up", color: "var(--status-up)" },
  { key: "down", label: "Down", color: "var(--status-down)" },
  { key: "degraded", label: "Degraded", color: "var(--status-degraded)" },
  { key: "unknown", label: "Unknown", color: "var(--status-unknown)" },
];

function getUptimeColor(pct) {
  if (pct >= 99.5) return "var(--status-up)";
  if (pct >= 95) return "var(--status-degraded)";
  return "var(--status-down)";
}

function HealthOverviewPanel({ currentStatus, uptime }) {
  const percentage = uptime?.percentage ?? 0;
  const uptimeColor = getUptimeColor(percentage);

  const { segments, total, allUp } = useMemo(() => {
    const up = currentStatus?.up ?? 0;
    const down = currentStatus?.down ?? 0;
    const degraded = currentStatus?.degraded ?? 0;
    const unknown = currentStatus?.unknown ?? 0;
    const t = up + down + degraded + unknown;
    const vals = { up, down, degraded, unknown };

    const segs = SEGMENTS.map((s) => ({
      ...s,
      count: vals[s.key],
      percentage: t > 0 ? (vals[s.key] / t) * 100 : 0,
    })).filter((s) => s.count > 0);

    return {
      segments: segs,
      total: t,
      allUp: down === 0 && degraded === 0 && unknown === 0 && up > 0,
    };
  }, [currentStatus]);

  const gaugeData = useMemo(
    () => [
      { name: "uptime", value: percentage },
      { name: "rest", value: Math.max(0, 100 - percentage) },
    ],
    [percentage],
  );

  return (
    <div
      id="health-overview-panel"
      className="rounded-xl p-6"
      style={{
        background: "var(--surface-raised)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div className="flex items-center justify-between mb-5">
        <h3
          className="text-sm font-semibold"
          style={{ color: "var(--text-secondary)" }}
        >
          Health Overview
        </h3>
        {allUp && (
          <span
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{
              backgroundColor: "var(--status-up-bg)",
              color: "var(--status-up)",
            }}
          >
            <CheckCircleRoundedIcon sx={{ fontSize: 14 }} />
            All Operational
          </span>
        )}
      </div>

      <div className="flex flex-col items-center">
        <div className="relative" style={{ width: 148, height: 148 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={gaugeData}
                cx="50%"
                cy="50%"
                innerRadius={52}
                outerRadius={68}
                startAngle={90}
                endAngle={-270}
                dataKey="value"
                stroke="none"
                cornerRadius={6}
                animationDuration={800}
              >
                <Cell fill={uptimeColor} />
                <Cell fill="var(--border)" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className="text-xl font-bold tracking-tight"
              style={{ color: "var(--text-primary)" }}
            >
              {formatPercentage(percentage, percentage >= 99 ? 2 : 1)}
            </span>
            <span
              className="text-[10px] font-medium"
              style={{ color: "var(--text-tertiary)" }}
            >
              uptime (24h)
            </span>
          </div>
        </div>
      </div>

      {total > 0 ? (
        <>
          <div
            className="flex w-full overflow-hidden mt-5 mb-3"
            style={{
              height: 10,
              borderRadius: "var(--radius-full)",
              backgroundColor: "var(--border)",
            }}
          >
            {segments.map((seg, i) => (
              <Tooltip
                key={seg.key}
                title={`${seg.label}: ${seg.count} (${seg.percentage.toFixed(1)}%)`}
                arrow
                placement="top"
              >
                <div
                  style={{
                    width: `${seg.percentage}%`,
                    backgroundColor: seg.color,
                    minWidth: seg.count > 0 ? 4 : 0,
                    transition: "width var(--transition-base)",
                    borderRadius:
                      i === 0 && segments.length === 1
                        ? "var(--radius-full)"
                        : i === 0
                          ? "var(--radius-full) 0 0 var(--radius-full)"
                          : i === segments.length - 1
                            ? "0 var(--radius-full) var(--radius-full) 0"
                            : "0",
                  }}
                />
              </Tooltip>
            ))}
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {SEGMENTS.map((seg) => {
              const count = currentStatus?.[seg.key] ?? 0;
              return (
                <div key={seg.key} className="flex items-center gap-1.5">
                  <span
                    className="inline-block shrink-0"
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "var(--radius-full)",
                      backgroundColor: seg.color,
                    }}
                  />
                  <span
                    className="text-xs"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {seg.label}
                  </span>
                  <span
                    className="text-xs font-bold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {formatNumber(count)}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <p
          className="text-sm text-center mt-5"
          style={{ color: "var(--text-tertiary)" }}
        >
          No monitors configured yet.
        </p>
      )}
    </div>
  );
}

export default memo(HealthOverviewPanel);
