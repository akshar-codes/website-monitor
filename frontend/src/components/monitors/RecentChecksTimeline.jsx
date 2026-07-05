import { memo } from "react";
import StatusBadge from "../shared/StatusBadge";
import ComponentStatusDots from "../shared/ComponentStatusDots";
import { formatTime, formatResponseTime } from "../../utils/formatters";
import { FAILURE_REASONS } from "../../utils/constants";

const STATUS_LINE_COLORS = {
  up: "var(--status-up)",
  down: "var(--status-down)",
  degraded: "var(--status-degraded)",
  unknown: "var(--status-unknown)",
};

function RecentChecksTimeline({ checks }) {
  const entries = (checks || []).slice(0, 20);

  return (
    <div
      className="rounded-xl p-6"
      style={{
        background: "var(--surface-raised)",
        border: "1px solid var(--border)",
      }}
    >
      <h3
        className="text-sm font-semibold mb-4"
        style={{ color: "var(--text-secondary)" }}
      >
        Recent Checks
      </h3>
      {entries.length === 0 ? (
        <div
          className="text-sm py-8 text-center"
          style={{ color: "var(--text-tertiary)" }}
        >
          No checks recorded yet
        </div>
      ) : (
        <div className="space-y-0">
          {entries.map((check, i) => (
            <div key={check._id || check.id || i} className="flex gap-4">
              {/* Timeline line + dot */}
              <div className="flex flex-col items-center">
                <div
                  className="w-3 h-3 rounded-full shrink-0 mt-1.5"
                  style={{
                    background:
                      STATUS_LINE_COLORS[check.status] ||
                      "var(--status-unknown)",
                  }}
                />
                {i < entries.length - 1 && (
                  <div
                    className="w-0.5 flex-1 my-1"
                    style={{ background: "var(--border)" }}
                  />
                )}
              </div>
              {/* Content */}
              <div className="flex-1 pb-4 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span
                    className="text-xs font-mono"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {formatTime(check.checkedAt)}
                  </span>
                  <StatusBadge status={check.status} size="sm" />
                  <span
                    className="text-xs font-medium"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {formatResponseTime(check.responseTime)}
                  </span>
                  {check.httpStatus && (
                    <span
                      className="text-xs"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      HTTP {check.httpStatus}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <ComponentStatusDots
                    frontendStatus={check.frontendStatus}
                    backendStatus={check.backendStatus}
                    databaseStatus={check.databaseStatus}
                  />
                  {check.failureReason && (
                    <span
                      className="text-xs px-2 py-0.5 rounded"
                      style={{
                        background: "var(--status-down-bg)",
                        color: "var(--status-down)",
                      }}
                    >
                      {FAILURE_REASONS[check.failureReason] ||
                        check.failureReason}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default memo(RecentChecksTimeline);
