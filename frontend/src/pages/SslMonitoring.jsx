import { RefreshCw, ShieldAlert } from "lucide-react";
import PageContainer from "../components/layout/PageContainer";
import PageHeader from "../components/layout/PageHeader";
import Button from "../components/ui/Button";
import SectionLabel from "../components/ui/SectionLabel";
import EmptyState from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";
import SslOverviewStats from "../features/ssl/SslOverviewStats";
import SslMonitorsTable from "../features/ssl/SslMonitorsTable";
import { useSslOverview } from "../hooks/useSsl";
import { formatDate } from "../utils/format";

export default function SslMonitoring() {
  const { data, loading, error, refetch } = useSslOverview();
  const overview = data?.data;

  const isInitialLoad = loading && !data;

  const expiringSoonCertificates = overview?.expiringSoonCertificates || [];
  const expiringSoonDomains = overview?.expiringSoonDomains || [];

  return (
    <PageContainer>
      <PageHeader
        title="SSL & Domain Monitoring"
        subtitle="Certificate validity, expiry tracking, and domain registration status across your monitors"
        actions={
          <Button variant="secondary" size="sm" icon={RefreshCw} onClick={refetch}>
            Refresh
          </Button>
        }
        className="mb-6"
      />

      {error && !data ? (
        <EmptyState
          icon={ShieldAlert}
          title="Couldn't load SSL overview"
          description="Something went wrong while fetching SSL data. Check your connection and try again."
          action={
            <Button variant="secondary" size="sm" onClick={refetch}>
              Try again
            </Button>
          }
          className="py-16"
        />
      ) : (
        <>
          <div className="mb-6">
            <SectionLabel className="mb-3">Overview</SectionLabel>
            <SslOverviewStats overview={overview} loading={isInitialLoad} />
          </div>

          {!isInitialLoad &&
            (expiringSoonCertificates.length > 0 || expiringSoonDomains.length > 0) && (
              <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
                {expiringSoonCertificates.length > 0 && (
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
                    <p className="mb-3 text-sm font-semibold text-amber-200">
                      Certificates needing attention
                    </p>
                    <div className="space-y-2">
                      {expiringSoonCertificates.map((item) => (
                        <div
                          key={item.id || item._id}
                          className="flex items-center justify-between gap-3 text-xs"
                        >
                          <span className="truncate text-text-secondary">
                            {item.monitor?.name || item.hostname}
                          </span>
                          <span className="shrink-0 font-medium text-amber-300">
                            {item.daysRemaining != null
                              ? item.daysRemaining < 0
                                ? `Expired ${formatDate(item.certificate?.validTo)}`
                                : `${item.daysRemaining}d left`
                              : "—"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {expiringSoonDomains.length > 0 && (
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
                    <p className="mb-3 text-sm font-semibold text-amber-200">
                      Domains needing attention
                    </p>
                    <div className="space-y-2">
                      {expiringSoonDomains.map((item) => (
                        <div
                          key={item.id || item._id}
                          className="flex items-center justify-between gap-3 text-xs"
                        >
                          <span className="truncate text-text-secondary">
                            {item.monitor?.name || item.domain?.name}
                          </span>
                          <span className="shrink-0 font-medium text-amber-300">
                            {item.domain?.daysRemaining != null
                              ? item.domain.daysRemaining < 0
                                ? `Expired ${formatDate(item.domain?.expiresAt)}`
                                : `${item.domain.daysRemaining}d left`
                              : "—"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

          <div>
            <SectionLabel className="mb-3">All Monitored Endpoints</SectionLabel>
            {isInitialLoad ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-lg" />
                ))}
              </div>
            ) : (
              <SslMonitorsTable items={overview?.monitors || []} loading={false} />
            )}
          </div>
        </>
      )}
    </PageContainer>
  );
}
