import { Link } from "react-router-dom";
import { ShieldOff, ExternalLink } from "lucide-react";
import SslStatusBadge from "../../components/ui/SslStatusBadge";
import { DOMAIN_STATUS_CONFIG, DOMAIN_STATUS } from "../../constants/ssl";
import EmptyState from "../../components/ui/EmptyState";
import { SkeletonRow } from "../../components/ui/Skeleton";
import { formatRelative, getDomain } from "../../utils/format";
import { monitorDetailsPath } from "../../constants/routes";
import { cn } from "../../utils/cn";

const TONE_TEXT = {
  success: "text-emerald-400",
  warning: "text-amber-400",
  danger: "text-red-400",
  neutral: "text-text-muted",
};

const COLUMN_HEADERS = [
  "Monitor",
  "SSL Status",
  "Cert Expiry",
  "Domain Status",
  "Domain Expiry",
  "Last Checked",
];

function formatDays(daysRemaining) {
  if (daysRemaining == null) return "—";
  if (daysRemaining < 0) return `${Math.abs(daysRemaining)}d ago`;
  return `${daysRemaining}d`;
}

export default function SslMonitorsTable({ items = [], loading = false }) {
  return (
    <div className="rounded-xl border border-border-subtle bg-bg-surface">
      <div className="border-b border-border-subtle px-5 py-4">
        <p className="text-sm font-semibold text-white">Monitors</p>
        <p className="mt-0.5 text-xs text-text-muted">
          Certificate and domain status per monitored endpoint
        </p>
      </div>

      <div className="grid grid-cols-[1fr_120px_90px_130px_90px_110px] items-center gap-3 border-b border-border-subtle px-5 py-3">
        {COLUMN_HEADERS.map((h) => (
          <p
            key={h}
            className="text-[11px] font-semibold uppercase tracking-wider text-text-disabled"
          >
            {h}
          </p>
        ))}
      </div>

      {loading ? (
        <div className="divide-y divide-[#1a1a1d]">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      ) : !items.length ? (
        <EmptyState
          icon={ShieldOff}
          title="No HTTPS monitors yet"
          description="Add an HTTPS monitor to start tracking its certificate and domain."
          className="py-14"
        />
      ) : (
        items.map((item) => {
          const monitor = item.monitor || {};
          const domainStatusConfig =
            DOMAIN_STATUS_CONFIG[item.domain?.status] ||
            DOMAIN_STATUS_CONFIG[DOMAIN_STATUS.UNKNOWN];

          return (
            <div
              key={monitor.id || monitor._id || item.id || item._id}
              className="grid grid-cols-[1fr_120px_90px_130px_90px_110px] items-center gap-3 border-b border-[#1a1a1d] px-5 py-4 transition-colors last:border-0 hover:bg-[#131315]"
            >
              <div className="min-w-0">
                <Link
                  to={monitorDetailsPath(monitor.id || monitor._id)}
                  className="flex items-center gap-1.5 truncate text-sm font-medium text-white transition-colors hover:text-emerald-400"
                >
                  {monitor.name || getDomain(monitor.url)}
                  <ExternalLink size={11} className="shrink-0 text-text-disabled" />
                </Link>
                <p className="truncate text-xs text-text-muted">{getDomain(monitor.url)}</p>
              </div>

              <div>
                <SslStatusBadge status={item.status} size="sm" />
              </div>

              <div>
                <p className="text-xs font-medium text-text-secondary">
                  {formatDays(item.daysRemaining)}
                </p>
              </div>

              <div>
                <span
                  className={cn(
                    "text-xs font-semibold",
                    TONE_TEXT[domainStatusConfig.tone] || TONE_TEXT.neutral,
                  )}
                >
                  {domainStatusConfig.label}
                </span>
              </div>

              <div>
                <p className="text-xs font-medium text-text-secondary">
                  {formatDays(item.domain?.daysRemaining)}
                </p>
              </div>

              <div>
                <p className="text-xs text-text-muted">
                  {item.lastCheckedAt ? formatRelative(item.lastCheckedAt) : "Never"}
                </p>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
