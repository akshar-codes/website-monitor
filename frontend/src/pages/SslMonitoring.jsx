import { useSslOverview } from "../hooks/useSsl";
import {
  Page,
  Panel,
  Metric,
  Status,
  Button,
  Table,
  Empty,
} from "../components/ui/Primitives";
import { RefreshCw, ShieldCheck, ShieldAlert, Globe2 } from "lucide-react";

const getDomainLabel = (record) => {
  const domain = record?.domain;
  if (typeof domain === "string") return domain;
  return (
    domain?.name || record?.hostname || record?.monitor?.url || "Unknown domain"
  );
};

export default function SslMonitoring() {
  const { data, loading, error, refetch } = useSslOverview();
  const overview = data?.data;

  const _isInitialLoad = loading && !data;

  const expiringSoonCertificates = overview?.expiringSoonCertificates || [];
  const expiringSoonDomains = overview?.expiringSoonDomains || [];

  const certificates = overview?.monitors || [];
  const certRows = certificates.map((item) => ({
    ...item,
    host: getDomainLabel(item),
    monitorName: item.monitor?.name || "Monitor",
    issuer:
      item.certificate?.issuer ||
      item.certificate?.issuerOrganization ||
      "Unknown issuer",
    expiry:
      item.certificate?.validTo || item.expiresAt || item.certificateExpiry,
    days: item.daysRemaining,
    state: item.status || "unknown",
  }));
  const columns = [
    { key: "host", label: "Domain" },
    { key: "monitorName", label: "Monitor" },
    { key: "issuer", label: "Issuer" },
    {
      key: "days",
      label: "Expires",
      render: (value) =>
        value == null
          ? "Unknown"
          : value < 0
            ? `${Math.abs(value)} days overdue`
            : `${value} days`,
    },
    {
      key: "state",
      label: "Certificate status",
      render: (value) => <Status value={value} />,
    },
  ];
  return (
    <Page
      title="SSL monitoring"
      description="Track certificate health and expiration for your monitored domains."
      actions={
        <Button variant="secondary" onClick={refetch}>
          <RefreshCw size={14} /> Refresh
        </Button>
      }
    >
      <div className="sw-metric-grid">
        <Metric
          label="Eligible websites"
          value={overview?.totals?.eligibleMonitors ?? "—"}
          icon={Globe2}
          note="HTTPS monitors"
        />
        <Metric
          label="Certificates monitored"
          value={overview?.totals?.monitoredCount ?? "—"}
          icon={ShieldCheck}
          note={`${overview?.totals?.notMonitoredCount ?? 0} not enabled`}
          tone="blue"
        />
        <Metric
          label="Healthy"
          value={
            overview?.statusCounts?.valid ??
            overview?.statusCounts?.healthy ??
            0
          }
          icon={ShieldCheck}
          note="Certificates in good standing"
        />
        <Metric
          label="Needs attention"
          value={
            expiringSoonCertificates.length + expiringSoonDomains.length || 0
          }
          icon={ShieldAlert}
          tone="amber"
          note="Expired or expiring soon"
        />
      </div>
      {error && (
        <div className="sw-notice error">
          SSL information could not be loaded.{" "}
          <button onClick={refetch}>Try again</button>
        </div>
      )}
      <Panel
        title="Certificates"
        subtitle="The latest certificate check for each domain"
      >
        {loading && !data ? (
          <div className="sw-loading">Loading certificate data…</div>
        ) : certRows.length ? (
          <Table columns={columns} rows={certRows} />
        ) : (
          <Empty title="No certificates found">
            Add an HTTPS monitor to begin tracking certificates.
          </Empty>
        )}
      </Panel>
      <div className="two-panel-grid">
        <Panel
          title="Certificates expiring soon"
          subtitle="Renew before visitors encounter security warnings"
        >
          <Table
            columns={[
              { key: "host", label: "Domain" },
              {
                key: "days",
                label: "Time remaining",
                render: (value) =>
                  value == null
                    ? "Unknown"
                    : value < 0
                      ? "Expired"
                      : `${value} days`,
              },
              {
                key: "status",
                label: "Status",
                render: (value) => <Status value={value} />,
              },
            ]}
            rows={expiringSoonCertificates.map((c) => ({
              ...c,
              host: getDomainLabel(c),
            }))}
            empty="No certificates are close to expiry."
          />
        </Panel>
        <Panel
          title="Domain renewals"
          subtitle="Domain registration expiration"
        >
          <Table
            columns={[
              { key: "host", label: "Domain" },
              {
                key: "days",
                label: "Time remaining",
                render: (value) =>
                  value == null
                    ? "Unknown"
                    : value < 0
                      ? "Expired"
                      : `${value} days`,
              },
              {
                key: "state",
                label: "Status",
                render: (_, row) => (
                  <Status value={row.domain?.status || row.status} />
                ),
              },
            ]}
            rows={expiringSoonDomains.map((c) => ({
              ...c,
              host: getDomainLabel(c),
              days: c.domain?.daysRemaining,
            }))}
            empty="No domain expiration warnings."
          />
        </Panel>
      </div>
    </Page>
  );
}
