import { Activity } from "lucide-react";
import { StatusDot } from "../../components/ui/StatusBadge";
import EmptyState from "../../components/ui/EmptyState";
import { SkeletonRow } from "../../components/ui/Skeleton";
import {
  formatRelative,
  formatResponseTime,
  formatDateTime,
} from "../../utils/format";

export default function MonitorRecentChecks({ checks = [], loading = false }) {
  return (
    <div className="rounded-xl border border-border-subtle bg-bg-surface">
      <div className="border-b border-border-subtle px-5 py-4">
        <p className="text-sm font-semibold text-white">Recent Checks</p>
        <p className="mt-0.5 text-xs text-text-muted">
          Latest health check results for this monitor
        </p>
      </div>

      <div className="divide-y divide-[#1a1a1d]">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
        ) : !checks.length ? (
          <EmptyState
            icon={Activity}
            title="No checks yet"
            description="Checks will appear here once this monitor has been polled."
            className="py-12"
          />
        ) : (
          checks.map((check) => (
            <div
              key={check.id || check._id}
              className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-[#131315]"
            >
              <StatusDot status={check.status} className="mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium capitalize text-[#e4e4e7]">
                  {check.status}
                </p>
                <p className="truncate text-xs text-text-muted">
                  {check.failureReason
                    ? check.failureReason.replace(/_/g, " ")
                    : check.httpStatus
                      ? `HTTP ${check.httpStatus}`
                      : "—"}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs font-medium text-text-secondary">
                  {formatResponseTime(check.responseTime)}
                </p>
                <p
                  className="text-[11px] text-text-disabled"
                  title={formatDateTime(check.checkedAt)}
                >
                  {formatRelative(check.checkedAt)}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
