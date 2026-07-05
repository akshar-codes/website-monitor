import { memo } from "react";
import StatusBadge from "../shared/StatusBadge";
import ComponentStatusDots from "../shared/ComponentStatusDots";
import RelativeTime from "../shared/RelativeTime";
import { formatResponseTime } from "../../utils/formatters";
import { FAILURE_REASONS } from "../../utils/constants";

function TriggerCheckCard({ check }) {
  if (!check) return null;

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
        Triggering Health Check
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex items-center gap-2">
          <span
            className="text-sm font-medium"
            style={{ color: "var(--text-secondary)" }}
          >
            Status:
          </span>
          <StatusBadge status={check.status} size="sm" />
        </div>
        <div>
          <span
            className="text-sm font-medium"
            style={{ color: "var(--text-secondary)" }}
          >
            Response Time:{" "}
          </span>
          <span className="text-sm" style={{ color: "var(--text-primary)" }}>
            {formatResponseTime(check.responseTime)}
          </span>
        </div>
        {check.httpStatus && (
          <div>
            <span
              className="text-sm font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              HTTP Status:{" "}
            </span>
            <span className="text-sm" style={{ color: "var(--text-primary)" }}>
              {check.httpStatus}
            </span>
          </div>
        )}
        {check.failureReason && (
          <div>
            <span
              className="text-sm font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              Failure:{" "}
            </span>
            <span
              className="text-sm px-2 py-0.5 rounded"
              style={{
                background: "var(--status-down-bg)",
                color: "var(--status-down)",
              }}
            >
              {FAILURE_REASONS[check.failureReason] || check.failureReason}
            </span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span
            className="text-sm font-medium"
            style={{ color: "var(--text-secondary)" }}
          >
            Components:
          </span>
          <ComponentStatusDots
            frontendStatus={check.frontendStatus}
            backendStatus={check.backendStatus}
            databaseStatus={check.databaseStatus}
          />
        </div>
        <div>
          <span
            className="text-sm font-medium"
            style={{ color: "var(--text-secondary)" }}
          >
            Checked:{" "}
          </span>
          <RelativeTime date={check.checkedAt} />
        </div>
      </div>
    </div>
  );
}

export default memo(TriggerCheckCard);
