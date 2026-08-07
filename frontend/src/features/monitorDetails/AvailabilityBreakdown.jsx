import { Server, Cpu, Database } from "lucide-react";
import { Skeleton } from "../../components/ui/Skeleton";
import { cn } from "../../utils/cn";

const COMPONENTS = [
  { key: "frontend", label: "Frontend", icon: Server },
  { key: "backend", label: "Backend", icon: Cpu },
  { key: "database", label: "Database", icon: Database },
];

function availabilityTone(pct) {
  if (pct >= 99) return { text: "text-emerald-400", bar: "bg-emerald-500" };
  if (pct >= 95) return { text: "text-amber-400", bar: "bg-amber-500" };
  return { text: "text-red-400", bar: "bg-red-500" };
}

/**
 * Component-level availability breakdown — sourced from
 * GET /api/dashboard/monitors/:id/analytics's `availability` field
 */
export default function AvailabilityBreakdown({ availability, loading }) {
  return (
    <div className="rounded-xl border border-border-subtle bg-bg-surface p-6">
      <p className="mb-1 text-sm font-semibold text-white">
        Component Availability
      </p>
      <p className="mb-5 text-xs text-text-muted">
        Uptime by service component over the selected range
      </p>

      {loading || !availability ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {COMPONENTS.map(({ key, label, icon: Icon }) => {
            const pct = availability[key] ?? 0;
            const tone = availabilityTone(pct);

            return (
              <div key={key}>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs text-text-secondary">
                    <Icon size={12} className="text-text-muted" />
                    {label}
                  </span>
                  <span className={cn("text-xs font-semibold", tone.text)}>
                    {pct.toFixed(2)}%
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-subtle">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      tone.bar,
                    )}
                    style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
