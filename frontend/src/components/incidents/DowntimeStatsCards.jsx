import { memo } from "react";
import { Skeleton } from "@mui/material";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutlined";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import SpeedIcon from "@mui/icons-material/Speed";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import { formatDurationSeconds, formatNumber } from "../../utils/formatters";

/* ──────────────────────── StatCard ──────────────────────── */

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

/* ──────────────────────── DowntimeStatsCards ──────────────────────── */

function DowntimeStatsCards({ stats, loading }) {
  const s = stats || {};
  const isLoading = loading || !stats;
  const sev = s.bySeverity || {};

  const severityText = !isLoading
    ? [
        sev.critical > 0 && `${sev.critical} critical`,
        sev.major > 0 && `${sev.major} major`,
        sev.minor > 0 && `${sev.minor} minor`,
      ]
        .filter(Boolean)
        .join(" · ") || "No incidents"
    : undefined;

  const windowLabel =
    s.window === "24h"
      ? "Last 24 hours"
      : s.window === "7d"
        ? "Last 7 days"
        : "Last 30 days";

  return (
    <div
      id="downtime-stats-cards"
      className="grid grid-cols-2 lg:grid-cols-5 gap-4"
    >
      <StatCard
        label="Total Incidents"
        value={isLoading ? "—" : formatNumber(s.totalIncidents)}
        subtext={severityText}
        color="var(--text-primary)"
        icon={WarningAmberIcon}
        loading={isLoading}
      />
      <StatCard
        label="Active Now"
        value={
          isLoading ? (
            "—"
          ) : (
            <span className="flex items-center gap-2">
              {s.ongoingCount}
              {s.ongoingCount > 0 && (
                <span className="relative flex h-2.5 w-2.5">
                  <span
                    className="absolute inline-flex h-full w-full rounded-full opacity-75"
                    style={{
                      background: "var(--status-down)",
                      animation:
                        "pulse-ring 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                    }}
                  />
                  <span
                    className="relative inline-flex rounded-full h-2.5 w-2.5"
                    style={{ background: "var(--status-down)" }}
                  />
                </span>
              )}
            </span>
          )
        }
        subtext={
          !isLoading ? `${formatNumber(s.resolvedCount)} resolved` : undefined
        }
        color={s.ongoingCount > 0 ? "var(--status-down)" : "var(--status-up)"}
        icon={ErrorOutlineIcon}
        loading={isLoading}
      />
      <StatCard
        label="Total Downtime"
        value={isLoading ? "—" : formatDurationSeconds(s.totalDowntimeSeconds)}
        subtext={!isLoading ? windowLabel : undefined}
        color="var(--status-down)"
        icon={AccessTimeIcon}
        loading={isLoading}
      />
      <StatCard
        label="MTTR"
        value={isLoading ? "—" : s.mttr ? formatDurationSeconds(s.mttr) : "—"}
        subtext="Mean time to resolve"
        color="var(--primary)"
        icon={SpeedIcon}
        loading={isLoading}
      />
      <StatCard
        label="Longest Incident"
        value={
          isLoading
            ? "—"
            : s.longestIncident
              ? formatDurationSeconds(s.longestIncident)
              : "—"
        }
        subtext="Worst case"
        color="var(--severity-critical)"
        icon={TrendingDownIcon}
        loading={isLoading}
      />
    </div>
  );
}

export default memo(DowntimeStatsCards);
