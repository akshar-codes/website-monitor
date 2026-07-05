import { memo, useMemo } from "react";
import { Link } from "react-router-dom";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import RelativeTime from "../shared/RelativeTime";
import { formatResponseTime } from "../../utils/formatters";
import { FAILURE_REASONS } from "../../utils/constants";

const EVENT_META = {
  down: {
    icon: ErrorOutlineRoundedIcon,
    color: "var(--status-down)",
    bg: "var(--status-down-bg)",
    label: "Down",
  },
  degraded: {
    icon: WarningAmberRoundedIcon,
    color: "var(--status-degraded)",
    bg: "var(--status-degraded-bg)",
    label: "Degraded",
  },
  unknown: {
    icon: WarningAmberRoundedIcon,
    color: "var(--status-unknown)",
    bg: "var(--status-unknown-bg)",
    label: "Unknown",
  },
};

function RecentEventsFeed({ checks }) {
  const events = useMemo(
    () =>
      (checks || []).filter((c) => c.status && c.status !== "up").slice(0, 8),
    [checks],
  );

  return (
    <div
      id="recent-events-feed"
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
          Recent Events
        </h3>
        {events.length > 0 && (
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: "var(--status-down-bg)",
              color: "var(--status-down)",
            }}
          >
            {events.length}
          </span>
        )}
      </div>

      {events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
          <CheckCircleRoundedIcon
            sx={{ fontSize: 32, color: "var(--status-up)", mb: 1.5 }}
          />
          <p
            className="text-sm font-medium"
            style={{ color: "var(--text-primary)" }}
          >
            No notable events
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>
            All recent checks came back healthy
          </p>
        </div>
      ) : (
        <div className="divide-y" style={{ borderColor: "var(--border)" }}>
          {events.map((check, idx) => {
            const meta = EVENT_META[check.status] || EVENT_META.unknown;
            const Icon = meta.icon;
            const monitorId = check.monitor?._id || check.monitor?.id;

            return (
              <Link
                key={check._id || check.id || idx}
                to={monitorId ? `/monitors/${monitorId}` : "/monitors"}
                className="flex items-start gap-3 px-5 py-3"
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
                <div
                  className="flex items-center justify-center rounded-lg shrink-0"
                  style={{ width: 32, height: 32, backgroundColor: meta.bg }}
                >
                  <Icon sx={{ fontSize: 16, color: meta.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p
                      className="text-sm font-medium truncate"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {check.monitor?.name || "Unknown monitor"}
                    </p>
                    <span
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                      style={{ backgroundColor: meta.bg, color: meta.color }}
                    >
                      {meta.label}
                    </span>
                  </div>
                  <p
                    className="text-xs mt-0.5"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {check.failureReason
                      ? FAILURE_REASONS[check.failureReason] ||
                        check.failureReason
                      : `Response ${formatResponseTime(check.responseTime)}`}
                  </p>
                </div>
                <RelativeTime
                  date={check.checkedAt}
                  className="text-xs! shrink-0"
                />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default memo(RecentEventsFeed);
