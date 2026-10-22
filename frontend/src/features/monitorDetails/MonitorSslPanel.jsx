import { RefreshCw, ShieldOff } from "lucide-react";
import Button from "../../components/ui/Button";
import SslStatusBadge from "../../components/ui/SslStatusBadge";
import SslExpiryCountdown from "../ssl/SslExpiryCountdown";
import SslCertificateDetails from "../ssl/SslCertificateDetails";
import DomainInfoCard from "../ssl/DomainInfoCard";
import SslWarningAlert from "../ssl/SslWarningAlert";
import Can from "../../components/access/Can";
import { useMonitorSsl, useSslMutations } from "../../hooks/useSsl";
import { Skeleton } from "../../components/ui/Skeleton";
import EmptyState from "../../components/ui/EmptyState";

export default function MonitorSslPanel({ monitorId }) {
  const { data, loading, refetch } = useMonitorSsl(monitorId);
  const payload = data?.data;

  const { triggerCheck, checking, updateSettings, updatingSettings } =
    useSslMutations(() => {
      refetch();
    });

  const isInitialLoad = loading && !data;

  if (isInitialLoad) {
    return (
      <div className="rounded-xl border border-border-subtle bg-bg-surface p-6">
        <div className="space-y-4">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  if (!payload?.eligible) {
    return (
      <div className="rounded-xl border border-border-subtle bg-bg-surface">
        <div className="border-b border-border-subtle px-6 py-4">
          <p className="text-sm font-semibold text-white">SSL &amp; Domain</p>
        </div>
        <EmptyState
          icon={ShieldOff}
          title="SSL monitoring not applicable"
          description="This monitor uses HTTP, not HTTPS, so there's no certificate to check."
          className="py-12"
        />
      </div>
    );
  }

  const ssl = payload.ssl || {};
  const enabled = payload.monitor?.sslMonitoringEnabled;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border-subtle bg-bg-surface p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <p className="text-sm font-semibold text-white">SSL &amp; Domain</p>
            <SslStatusBadge status={ssl.status} size="sm" />
          </div>
          <div className="flex items-center gap-2">
            <Can permission="monitor:update">
              <Button
                variant="secondary"
                size="xs"
                onClick={() => updateSettings(monitorId, !enabled)}
                loading={updatingSettings}
              >
                {enabled ? "Disable monitoring" : "Enable monitoring"}
              </Button>
              <Button
                variant="secondary"
                size="xs"
                icon={RefreshCw}
                onClick={() => triggerCheck(monitorId)}
                loading={checking}
                disabled={!enabled}
              >
                Check now
              </Button>
            </Can>
          </div>
        </div>

        <SslWarningAlert
          status={ssl.status}
          daysRemaining={ssl.daysRemaining}
          className="mb-5"
        />

        <div className="flex flex-wrap items-center justify-center gap-8 py-2 sm:justify-start">
          <SslExpiryCountdown
            daysRemaining={ssl.daysRemaining}
            label="Certificate expiry"
          />
          <SslExpiryCountdown
            daysRemaining={ssl.domain?.daysRemaining}
            label="Domain expiry"
            maxDays={90}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SslCertificateDetails certificate={ssl.certificate} loading={false} />
        <DomainInfoCard domain={ssl.domain} loading={false} />
      </div>
    </div>
  );
}
