import { useEffect, useState } from "react";
import {
  Activity,
  Copy,
  Download,
  Globe,
  ShieldCheck,
  Waypoints,
} from "lucide-react";
import { toast } from "sonner";
import Button from "../../components/ui/Button";
import * as monitorsApi from "../../services/api/monitors";

const Card = ({ title, icon: Icon, children }) => (
  <section className="rounded-xl border border-border-default bg-bg-surface p-4">
    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
      <Icon size={15} className="text-emerald-400" />
      {title}
    </h3>
    {children}
  </section>
);

const Value = ({ label, value }) => (
  <div className="flex justify-between gap-4 border-b border-border-default/60 py-2 last:border-0">
    <span className="text-xs text-text-muted">{label}</span>
    <span className="max-w-[65%] break-all text-right text-xs text-text-secondary">
      {value ?? "—"}
    </span>
  </div>
);

export default function MonitorDiagnostics({ monitorId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    monitorsApi
      .getMonitorDiagnostics(monitorId)
      .then((response) => {
        if (alive) {
          setData(response.data);
          setError(false);
        }
      })
      .catch(() => {
        if (alive) setError(true);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [monitorId]);

  const exportJson = JSON.stringify(data, null, 2);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(exportJson);
      toast.success("Diagnostics copied");
    } catch {
      toast.error("Could not copy diagnostics");
    }
  };
  const download = () => {
    const url = URL.createObjectURL(
      new Blob([exportJson], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `monitor-diagnostics-${monitorId}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">
            HTTP &amp; DNS diagnostics
          </h2>
          <p className="mt-1 text-xs text-text-muted">
            Captured during the most recent scheduled check.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" icon={Copy} disabled={!data} onClick={copy}>
            Copy JSON
          </Button>
          <Button size="sm" icon={Download} disabled={!data} onClick={download}>
            Export
          </Button>
        </div>
      </div>
      {loading ? (
        <p className="rounded-xl border border-border-default p-5 text-sm text-text-muted">
          Loading diagnostics…
        </p>
      ) : error ? (
        <p className="rounded-xl border border-red-500/20 p-5 text-sm text-red-300">
          Diagnostics could not be loaded.
        </p>
      ) : !data?.checkedAt ? (
        <p className="rounded-xl border border-border-default p-5 text-sm text-text-muted">
          No check has completed yet. Diagnostics appear after the first poll.
        </p>
      ) : (
        <>
          <p className="mb-3 text-xs text-text-muted">
            Last checked {new Date(data.checkedAt).toLocaleString()}
          </p>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="HTTP response & performance" icon={Activity}>
              <Value
                label="Status"
                value={
                  data.http?.status
                    ? `${data.http.status} ${data.http.statusText || ""}`
                    : "No response"
                }
              />
              <Value label="Final URL" value={data.http?.finalUrl} />
              <Value
                label="Response time"
                value={
                  data.http?.responseTimeMs != null
                    ? `${data.http.responseTimeMs} ms`
                    : null
                }
              />
              <Value
                label="DNS time"
                value={
                  data.http?.timing?.dnsMs != null
                    ? `${data.http.timing.dnsMs} ms`
                    : null
                }
              />
              <Value label="Failure" value={data.http?.failureReason} />
            </Card>
            <Card title="DNS lookup" icon={Globe}>
              <Value label="Hostname" value={data.dns?.hostname} />
              <Value
                label="Addresses"
                value={
                  data.dns?.addresses?.length
                    ? data.dns.addresses
                        .map((entry) => `${entry.address} (IPv${entry.family})`)
                        .join(", ")
                    : data.dns?.error || "No DNS data"
                }
              />
              <Value
                label="Lookup time"
                value={
                  data.dns?.durationMs != null
                    ? `${data.dns.durationMs} ms`
                    : null
                }
              />
            </Card>
            <Card title="Security headers" icon={ShieldCheck}>
              {data.securityHeaders.map((header) => (
                <Value
                  key={header.name}
                  label={header.name}
                  value={
                    header.present
                      ? header.value
                      : `Missing · ${header.purpose}`
                  }
                />
              ))}
            </Card>
            <Card title="Response headers" icon={Activity}>
              {Object.entries(data.headers || {}).length ? (
                Object.entries(data.headers).map(([name, value]) => (
                  <Value key={name} label={name} value={value} />
                ))
              ) : (
                <p className="text-xs text-text-muted">
                  No response headers recorded.
                </p>
              )}
            </Card>
            <Card title="Redirect history" icon={Waypoints}>
              {data.redirects?.length ? (
                data.redirects.map((hop, index) => (
                  <div
                    key={`${hop.url}-${index}`}
                    className="border-b border-border-default/60 py-2 text-xs last:border-0"
                  >
                    <p className="break-all text-text-secondary">{hop.url}</p>
                    <p className="mt-1 text-text-muted">
                      HTTP {hop.status} → {hop.location}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-text-muted">
                  No redirects in the latest check.
                </p>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
