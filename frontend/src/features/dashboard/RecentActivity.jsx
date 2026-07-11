import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { StatusDot } from "../../components/ui/StatusBadge";
import {
  formatRelative,
  formatResponseTime,
  getDomain,
} from "../../utils/format";
import { SkeletonRow } from "../../components/ui/Skeleton";
import EmptyState from "../../components/ui/EmptyState";
import { Activity } from "lucide-react";

export default function RecentActivity({ checks = [], loading = false }) {
  return (
    <div className="rounded-xl border border-border-subtle bg-bg-surface">
      <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-white">Recent Activity</p>
          <p className="text-xs text-text-muted">Latest health checks</p>
        </div>
        <Link
          to="/monitors"
          className="flex items-center gap-1 text-[11px] font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
        >
          View all <ArrowRight size={12} />
        </Link>
      </div>

      <div className="divide-y divide-[#1a1a1d]">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
        ) : !checks.length ? (
          <EmptyState
            icon={Activity}
            title="No checks yet"
            description="Monitors will appear here once they run."
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
                <p className="truncate text-sm font-medium text-[#e4e4e7]">
                  {check.monitor?.name || getDomain(check.monitor?.url)}
                </p>
                <p className="truncate text-xs text-text-muted">
                  {getDomain(check.monitor?.url)}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs font-medium text-text-secondary">
                  {formatResponseTime(check.responseTime)}
                </p>
                <p className="text-[11px] text-text-disabled">
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
