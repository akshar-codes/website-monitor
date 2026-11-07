import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Globe2, Save, RefreshCw } from "lucide-react";
import { Page, Panel, Button, Notice } from "../components/ui/Primitives";
import {
  getAdminProbeRegionSettings,
  updateAdminProbeRegionSettings,
} from "../services/api/admin";

export default function AdminProbeRegions() {
  const [regions, setRegions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const load = async () => {
    setLoading(true);
    try {
      setRegions(
        (await getAdminProbeRegionSettings()).map((region) => ({
          ...region,
          ipText: region.egressIps.join("\n"),
        })),
      );
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    let active = true;
    getAdminProbeRegionSettings()
      .then((data) => {
        if (!active) return;
        setRegions(
          data.map((region) => ({
            ...region,
            ipText: region.egressIps.join("\n"),
          })),
        );
        setError(false);
      })
      .catch(() => {
        if (!active) return;
        setError(true);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const updated = await updateAdminProbeRegionSettings(
        regions.map(({ regionId, ipText }) => ({
          regionId,
          egressIps: ipText
            .split(/[\n,]+/)
            .map((ip) => ip.trim())
            .filter(Boolean),
        })),
      );
      setRegions(
        updated.map((region) => ({
          ...region,
          ipText: region.egressIps.join("\n"),
        })),
      );
      toast.success("Regional probe IPs saved");
    } catch (e) {
      toast.error(
        e.response?.data?.message ||
          "Could not save probe IPs. Check that each value is a valid IP address.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page
      eyebrow="ADMIN"
      title="Probe egress IPs"
      description="Set the public outbound IP addresses customers must allowlist for checks from each monitoring region. Update these after deploying or changing a probe host."
      actions={
        <Button variant="secondary" onClick={load} disabled={loading}>
          <RefreshCw size={14} /> Refresh
        </Button>
      }
    >
      {error && (
        <Notice tone="error">Could not load regional probe settings.</Notice>
      )}
      {loading ? (
        <Panel>Loading regional settings…</Panel>
      ) : (
        <form onSubmit={save} className="space-y-4">
          {regions.map((region) => (
            <Panel key={region.regionId}>
              <div className="flex items-center gap-2">
                <Globe2 size={18} />
                <h2>
                  {region.name} · {region.location}
                </h2>
              </div>
              <label
                className="mt-3 block text-sm font-medium"
                htmlFor={`ips-${region.regionId}`}
              >
                Public egress IP addresses
              </label>
              <textarea
                id={`ips-${region.regionId}`}
                className="sw-input mt-1 min-h-24 w-full font-mono"
                value={region.ipText}
                onChange={(event) =>
                  setRegions((current) =>
                    current.map((item) =>
                      item.regionId === region.regionId
                        ? { ...item, ipText: event.target.value }
                        : item,
                    ),
                  )
                }
                placeholder="203.0.113.10"
                spellCheck="false"
              />
              <p className="mt-1 text-sm text-slate-500">
                One IPv4 or IPv6 address per line. Leave blank until a stable
                egress IP is configured.
              </p>
            </Panel>
          ))}
          <Button type="submit" disabled={saving}>
            <Save size={14} /> {saving ? "Saving…" : "Save regional IPs"}
          </Button>
        </form>
      )}
    </Page>
  );
}
