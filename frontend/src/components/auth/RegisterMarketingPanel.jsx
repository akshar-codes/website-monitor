import { CheckCircle } from "lucide-react";

const STEPS = [
  {
    num: "01",
    title: "Create your account",
    desc: "Free to start — no credit card required.",
  },
  {
    num: "02",
    title: "Add a monitor",
    desc: "Point WebMonitor at any HTTP or HTTPS endpoint.",
  },
  {
    num: "03",
    title: "Watch it in real time",
    desc: "Uptime, response time, and incidents update live.",
  },
];

const BENEFITS = [
  "Unlimited monitors",
  "8 check intervals",
  "Automatic incident tracking",
  "Works on any device",
];

function MiniDashboardPreview() {
  const bars = [30, 55, 40, 70, 48, 82, 60, 90, 65, 58, 76, 95];
  return (
    <div className="overflow-hidden rounded-xl border border-border-subtle bg-bg-elevated">
      <div className="flex items-center gap-1.5 border-b border-border-subtle px-4 py-2.5">
        {["#ef4444", "#f59e0b", "#10b981"].map((c) => (
          <span
            key={c}
            className="h-2 w-2 rounded-full opacity-70"
            style={{ background: c }}
          />
        ))}
        <span className="ml-2 text-[10px] text-text-disabled">
          dashboard · overview
        </span>
      </div>

      <div className="p-4">
        <div className="mb-4 grid grid-cols-3 gap-2">
          {[
            { l: "Monitors", v: "18" },
            { l: "Online", v: "17" },
            { l: "Avg Response", v: "182ms" },
          ].map((s) => (
            <div
              key={s.l}
              className="rounded-lg border border-border-subtle bg-bg-surface p-2.5"
            >
              <p className="mb-0.5 text-[9px] text-text-muted">{s.l}</p>
              <p className="text-xs font-bold text-white">{s.v}</p>
            </div>
          ))}
        </div>

        <div className="mb-3 rounded-lg border border-border-subtle bg-bg-surface p-3">
          <p className="mb-2 text-[9px] font-semibold uppercase tracking-wider text-text-disabled">
            Response time — 24h
          </p>
          <div className="flex h-12 items-end gap-1">
            {bars.map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-sm"
                style={{
                  height: `${h}%`,
                  background: i === 11 ? "#10b981" : "rgba(16,185,129,0.25)",
                }}
              />
            ))}
          </div>
        </div>

        {[
          { label: "api.myapp.com", status: "Operational", up: true },
          { label: "checkout-service", status: "Degraded", up: false },
        ].map((row) => (
          <div
            key={row.label}
            className="mb-1.5 flex items-center justify-between rounded-lg border border-border-subtle bg-bg-surface px-3 py-2"
          >
            <div className="flex items-center gap-2">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: row.up ? "#10b981" : "#f59e0b" }}
              />
              <span className="text-[11px] text-text-secondary">
                {row.label}
              </span>
            </div>
            <span
              className="text-[11px] font-medium"
              style={{ color: row.up ? "#10b981" : "#f59e0b" }}
            >
              {row.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function RegisterMarketingPanel() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-8 animate-fade-in">
        <h1 className="mb-3 text-[clamp(26px,2.6vw,38px)] font-semibold leading-tight tracking-tight text-white">
          Your infrastructure,
          <br />
          <span className="text-emerald-400">always in view.</span>
        </h1>
        <p className="max-w-[400px] text-[14px] leading-relaxed text-text-secondary">
          Set up your first monitor in under two minutes and start building an
          uptime history you can trust.
        </p>
      </div>

      <div className="mb-8 animate-fade-in">
        <MiniDashboardPreview />
      </div>

      <div className="mb-8 animate-fade-in">
        <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
          How it works
        </p>
        <div className="flex flex-col gap-3">
          {STEPS.map((s) => (
            <div key={s.num} className="flex items-start gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 font-mono text-[11px] font-bold text-emerald-400">
                {s.num}
              </div>
              <div className="pt-0.5">
                <p className="text-[12px] font-semibold leading-tight text-[#e4e4e7]">
                  {s.title}
                </p>
                <p className="text-[11px] leading-snug text-text-muted">
                  {s.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-auto flex animate-fade-in flex-wrap gap-2">
        {BENEFITS.map((b) => (
          <div
            key={b}
            className="flex items-center gap-1.5 rounded-full border border-border-default bg-bg-elevated px-3 py-1.5 text-[11px] font-medium text-text-secondary"
          >
            <CheckCircle size={11} className="text-emerald-400" />
            {b}
          </div>
        ))}
      </div>
    </div>
  );
}
