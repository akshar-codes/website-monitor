import { Globe, Building2, Calendar, Server } from "lucide-react";
import { Skeleton } from "../../components/ui/Skeleton";
import EmptyState from "../../components/ui/EmptyState";
import { formatDate } from "../../utils/format";
import { DOMAIN_STATUS_CONFIG, DOMAIN_STATUS } from "../../constants/ssl";
import { cn } from "../../utils/cn";

const TONE_TEXT = {
  success: "text-emerald-400",
  warning: "text-amber-400",
  danger: "text-red-400",
  neutral: "text-text-muted",
};

export default function DomainInfoCard({ domain, loading }) {
  if (loading) {
    return (
      <div className="rounded-xl border border-border-subtle bg-bg-surface p-6">
        <div className="space-y-4">
          <Skeleton className="h-3 w-32" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!domain || !domain.name) {
    return (
      <div className="rounded-xl border border-border-subtle bg-bg-surface">
        <div className="border-b border-border-subtle px-6 py-4">
          <p className="text-sm font-semibold text-white">Domain Information</p>
        </div>
        <EmptyState
          icon={Globe}
          title="No domain data yet"
          description="Registration details will appear after the next check, if the registry publishes them."
          className="py-12"
        />
      </div>
    );
  }

  const statusConfig =
    DOMAIN_STATUS_CONFIG[domain.status] ||
    DOMAIN_STATUS_CONFIG[DOMAIN_STATUS.UNKNOWN];

  return (
    <div className="rounded-xl border border-border-subtle bg-bg-surface p-6">
      <div className="mb-5 flex items-center justify-between">
        <p className="text-sm font-semibold text-white">Domain Information</p>
        <span
          className={cn(
            "text-xs font-semibold",
            TONE_TEXT[statusConfig.tone] || TONE_TEXT.neutral,
          )}
        >
          {statusConfig.label}
        </span>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-bg-elevated">
            <Globe size={14} className="text-text-secondary" />
          </div>
          <div>
            <p className="text-[11px] text-text-muted">Domain</p>
            <p className="mt-0.5 text-sm font-medium text-white">
              {domain.name}
            </p>
          </div>
        </div>

        {domain.registrar && (
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-bg-elevated">
              <Building2 size={14} className="text-text-secondary" />
            </div>
            <div>
              <p className="text-[11px] text-text-muted">Registrar</p>
              <p className="mt-0.5 text-sm font-medium text-white">
                {domain.registrar}
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[11px] text-text-muted">Registered</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm font-medium text-white">
              <Calendar size={12} className="text-text-disabled" />
              {domain.registeredAt ? formatDate(domain.registeredAt) : "—"}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-text-muted">Expires</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm font-medium text-white">
              <Calendar size={12} className="text-text-disabled" />
              {domain.expiresAt ? formatDate(domain.expiresAt) : "—"}
            </p>
          </div>
        </div>

        {domain.nameServers?.length > 0 && (
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-[11px] text-text-muted">
              <Server size={11} /> Name servers
            </p>
            <div className="flex flex-wrap gap-1.5">
              {domain.nameServers.map((ns) => (
                <span
                  key={ns}
                  className="rounded-full border border-border-default bg-bg-elevated px-2 py-0.5 text-[11px] text-text-secondary"
                >
                  {ns}
                </span>
              ))}
            </div>
          </div>
        )}

        {domain.lookupError && (
          <p className="text-[11px] text-amber-400">
            Last lookup warning: {domain.lookupError}
          </p>
        )}
      </div>
    </div>
  );
}
