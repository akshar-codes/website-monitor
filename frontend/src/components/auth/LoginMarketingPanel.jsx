import { Activity, BellRing, LineChart, Layers } from "lucide-react";

const FEATURES = [
  {
    icon: Activity,
    title: "Real-Time Uptime Checks",
    desc: "Automated health checks on the interval you choose, from every 30 seconds to hourly.",
  },
  {
    icon: BellRing,
    title: "Instant Incident Detection",
    desc: "Consecutive failures automatically open an incident with severity and root cause.",
  },
  {
    icon: LineChart,
    title: "Response Time Analytics",
    desc: "24h, 7d, and 30d trend charts for uptime, response time, and status distribution.",
  },
  {
    icon: Layers,
    title: "Unified Dashboard",
    desc: "Every monitor's health, recent activity, and open incidents in one place.",
  },
];

const STATS = [
  { value: "24/7", label: "Monitoring" },
  { value: "8", label: "Check intervals" },
  { value: "3", label: "Time windows" },
  { value: "0", label: "Setup cost" },
];

export default function LoginMarketingPanel() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-10 animate-fade-in">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
          <span className="h-1.5 w-1.5 animate-pulse-subtle rounded-full bg-emerald-400" />
          All systems monitored in real time
        </div>

        <h1 className="mb-4 text-[clamp(30px,3vw,42px)] font-semibold leading-tight tracking-tight text-white">
          Know the moment
          <br />
          <span className="text-emerald-400">something goes down.</span>
        </h1>

        <p className="max-w-[440px] text-[15px] leading-relaxed text-text-secondary">
          WebMonitor watches your sites and APIs around the clock, tracks
          incidents automatically, and gives you the analytics to prove your
          uptime.
        </p>
      </div>

      <div className="mb-10 flex animate-fade-in flex-col gap-2">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="flex items-start gap-4 rounded-xl border border-transparent px-4 py-3.5 transition-colors hover:border-border-default hover:bg-bg-overlay"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
              <f.icon size={16} />
            </div>
            <div>
              <p className="mb-0.5 text-[13px] font-semibold text-[#e4e4e7]">
                {f.title}
              </p>
              <p className="text-[12px] leading-relaxed text-text-muted">
                {f.desc}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-auto grid animate-fade-in grid-cols-4 gap-2">
        {STATS.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-border-subtle bg-bg-elevated px-2 py-3 text-center"
          >
            <p className="mb-0.5 text-xl font-bold leading-tight text-emerald-400">
              {s.value}
            </p>
            <p className="text-[10px] leading-tight text-text-muted">
              {s.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
