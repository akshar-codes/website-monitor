import { memo } from "react";
import { Link } from "react-router-dom";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import DnsRoundedIcon from "@mui/icons-material/DnsRounded";
import { useMonitors } from "../../hooks/queries/useMonitors";
import RelativeTime from "../shared/RelativeTime";
import LoadingSkeleton from "../shared/LoadingSkeleton";
import { truncateUrl, formatInterval } from "../../utils/formatters";

function MonitorRow({ monitor }) {
  const isFailing = monitor.consecutiveFailures > 0;
  const statusColor = !monitor.active
    ? "var(--status-paused)"
    : isFailing
      ? "var(--status-down)"
      : "var(--status-up)";
  const statusLabel = !monitor.active
    ? "Paused"
    : isFailing
      ? "Failing"
      : "Healthy";
  const monitorId = monitor._id || monitor.id;

  return (
    <Link
      to={`/monitors/${monitorId}`}
      id={`monitor-summary-${monitorId}`}
      className="flex items-center gap-3 px-5 py-3"
      style={{
        textDecoration: "none",
        transition: "background-color var(--transition-fast)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = "var(--surface)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "transparent";
      }}
    >
      <span
        className="shrink-0"
        style={{
          width: 8,
          height: 8,
          borderRadius: "var(--radius-full)",
          backgroundColor: statusColor,
        }}
      />
      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-medium truncate"
          style={{ color: "var(--text-primary)" }}
        >
          {monitor.name}
        </p>
        <p
          className="text-xs truncate"
          style={{ color: "var(--text-tertiary)" }}
        >
          {truncateUrl(monitor.url, 40)} · {formatInterval(monitor.interval)}
        </p>
      </div>
      <div className="text-right shrink-0">
        <span
          className="text-xs font-semibold block"
          style={{ color: statusColor }}
        >
          {statusLabel}
        </span>
        <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
          <RelativeTime date={monitor.lastCheckedAt} />
        </span>
      </div>
      <ChevronRightRoundedIcon
        sx={{ fontSize: 16, color: "var(--text-tertiary)", flexShrink: 0 }}
      />
    </Link>
  );
}

function MonitorSummaryPanel() {
  const { data, isLoading, isError } = useMonitors({
    page: 1,
    limit: 6,
    sortBy: "updatedAt",
    order: "desc",
  });

  const monitors = data?.data || [];

  return (
    <div
      id="monitor-summary-panel"
      className="rounded-xl overflow-hidden"
      style={{
        backgroundColor: "var(--surface-raised)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div
        className="flex items-center justify-between px-5 py-3.5"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <h3
          className="text-sm font-semibold"
          style={{ color: "var(--text-secondary)" }}
        >
          Monitor Summary
        </h3>
        <Link
          to="/monitors"
          className="text-xs font-semibold hover:underline"
          style={{ color: "var(--primary)" }}
        >
          View all
        </Link>
      </div>

      {isLoading ? (
        <div className="p-4">
          <LoadingSkeleton variant="text" count={3} />
        </div>
      ) : isError || monitors.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
          <DnsRoundedIcon
            sx={{
              fontSize: 32,
              color: "var(--text-tertiary)",
              opacity: 0.6,
              mb: 1.5,
            }}
          />
          <p
            className="text-sm font-medium"
            style={{ color: "var(--text-primary)" }}
          >
            No monitors yet
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>
            Add a monitor to start tracking uptime
          </p>
        </div>
      ) : (
        <div className="divide-y" style={{ borderColor: "var(--border)" }}>
          {monitors.map((monitor) => (
            <MonitorRow key={monitor._id || monitor.id} monitor={monitor} />
          ))}
        </div>
      )}
    </div>
  );
}

export default memo(MonitorSummaryPanel);
