import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import DowntimeStatsCards from "../insights/DowntimeStatsCards";
import { useDowntimeStats } from "../../hooks/useInsights";
import { useAuth } from "../../hooks/useAuth";
import { PLANS } from "../../constants/plans";
import { formatDuration } from "../../utils/format";
import { Skeleton } from "../../components/ui/Skeleton";
import { cn } from "../../utils/cn";

const WINDOWS = [
  { label: "24h", value: "24h" },
  { label: "7d", value: "7d" },
  { label: "30d", value: "30d" },
];

function WindowSelector({ value, onChange }) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-border-default bg-bg-elevated p-0.5">
      {WINDOWS.map((w) => (
        <button
          key={w.value}
          onClick={() => onChange(w.value)}
          className={cn(
            "rounded-md px-3 py-1 text-[11px] font-medium transition-all",
            value === w.value
              ? "bg-bg-subtle text-white"
              : "text-text-muted hover:text-text-secondary",
          )}
        >
          {w.label}
        </button>
      ))}
    </div>
  );
}

export default function DowntimeSummary() {
  const { plan } = useAuth();
  const defaultWindow = plan === PLANS.FREE ? "7d" : "30d";
  const [window, setWindow] = useState(defaultWindow);
  const { data, loading } = useDowntimeStats({ window });
  const stats = data?.data;

  const topMonitors = stats?.topAffectedMonitors || [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-text-muted">
          Downtime Summary — {window}
        </p>
        <WindowSelector value={window} onChange={setWindow} />
      </div>

      <DowntimeStatsCards stats={stats} loading={loading} />

      <div className="rounded-xl border border-border-subtle bg-bg-surface p-6">
        <p className="mb-1 text-sm font-semibold text-white">
          Most affected monitors
        </p>
        <p className="mb-4 text-xs text-text-muted">
          Ranked by incident count in the selected window
        </p>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : !topMonitors.length ? (
          <p className="py-6 text-center text-sm text-text-muted">
            No incidents in this window
          </p>
        ) : (
          <div className="divide-y divide-[#1a1a1d]">
            {topMonitors.map((m) => (
              <div
                key={m.monitorId}
                className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-500/10">
                  <AlertTriangle size={14} className="text-red-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">
                    {m.name || "Unknown monitor"}
                  </p>
                  <p className="truncate text-[11px] text-text-muted">
                    {m.url || "—"}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold text-white">
                    {m.incidentCount} incident{m.incidentCount !== 1 ? "s" : ""}
                  </p>
                  <p className="text-[11px] text-text-muted">
                    {formatDuration(m.totalDowntime)} downtime
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
