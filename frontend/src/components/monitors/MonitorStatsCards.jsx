import { memo } from "react";
import { Skeleton } from "@mui/material";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TimerIcon from "@mui/icons-material/Timer";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutlined";
import { formatPercentage, formatResponseTime } from "../../utils/formatters";

function getUptimeColor(pct) {
  if (pct == null) return "var(--text-tertiary)";
  if (pct >= 99.9) return "var(--status-up)";
  if (pct >= 99) return "var(--status-degraded)";
  return "var(--status-down)";
}

function StatCard({ label, value, subtext, color, icon: Icon, loading }) {
  return (
    <div
      className="rounded-xl p-5 transition-shadow duration-200"
      style={{
        background: "var(--surface-raised)",
        border: "1px solid var(--border)",
        borderLeft: `4px solid ${color}`,
        boxShadow: "var(--shadow-sm)",
      }}
    >
      {loading ? (
        <>
          <Skeleton width={80} height={16} sx={{ bgcolor: "var(--border)" }} />
          <Skeleton
            width={60}
            height={36}
            sx={{ mt: 1, bgcolor: "var(--border)" }}
          />
        </>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-2">
            <Icon sx={{ fontSize: 18, color: "var(--text-tertiary)" }} />
            <span
              className="text-xs font-medium uppercase tracking-wide"
              style={{ color: "var(--text-tertiary)" }}
            >
              {label}
            </span>
          </div>
          <div className="text-2xl font-bold" style={{ color }}>
            {value}
          </div>
          {subtext && (
            <div
              className="text-xs mt-1"
              style={{ color: "var(--text-tertiary)" }}
            >
              {subtext}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MonitorStatsCards({
  stats24h,
  stats7d,
  stats30d,
  consecutiveFailures,
}) {
  const loading24h = !stats24h;
  const loading7d = !stats7d;
  const loading30d = !stats30d;

  const pct24 = stats24h?.uptime?.percentage;
  const pct7 = stats7d?.uptime?.percentage;
  const pct30 = stats30d?.uptime?.percentage;
  const avgRT = stats24h?.responseTime?.average;
  const minRT = stats24h?.responseTime?.min;
  const maxRT = stats24h?.responseTime?.max;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
      <StatCard
        label="24h Uptime"
        value={formatPercentage(pct24)}
        color={getUptimeColor(pct24)}
        icon={TrendingUpIcon}
        loading={loading24h}
      />
      <StatCard
        label="7d Uptime"
        value={formatPercentage(pct7)}
        color={getUptimeColor(pct7)}
        icon={TrendingUpIcon}
        loading={loading7d}
      />
      <StatCard
        label="30d Uptime"
        value={formatPercentage(pct30)}
        color={getUptimeColor(pct30)}
        icon={TrendingUpIcon}
        loading={loading30d}
      />
      <StatCard
        label="Avg Response"
        value={formatResponseTime(avgRT)}
        subtext={
          minRT != null
            ? `Min: ${formatResponseTime(minRT)} · Max: ${formatResponseTime(maxRT)}`
            : undefined
        }
        color="var(--primary)"
        icon={TimerIcon}
        loading={loading24h}
      />
      <StatCard
        label="Failures"
        value={consecutiveFailures ?? 0}
        color={
          consecutiveFailures > 0 ? "var(--status-down)" : "var(--status-up)"
        }
        icon={ErrorOutlineIcon}
        loading={false}
      />
    </div>
  );
}

export default memo(MonitorStatsCards);
