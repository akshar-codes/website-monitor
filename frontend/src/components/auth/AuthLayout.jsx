import { Activity } from "lucide-react";

function MeshBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-[#08120d] via-[#0a1512] to-[#09090b]" />
      <div
        className="absolute rounded-full"
        style={{
          width: 560,
          height: 560,
          top: -120,
          left: -100,
          background:
            "radial-gradient(circle, rgba(16,185,129,0.18) 0%, transparent 65%)",
          filter: "blur(50px)",
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          width: 480,
          height: 480,
          bottom: -100,
          right: -60,
          background:
            "radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 65%)",
          filter: "blur(60px)",
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
    </div>
  );
}

function BrandMark() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10">
        <Activity size={18} className="text-emerald-400" />
      </div>
      <div>
        <p className="text-sm font-semibold leading-tight text-white">
          WebMonitor
        </p>
        <p className="text-[11px] leading-tight text-text-muted">
          Uptime Platform
        </p>
      </div>
    </div>
  );
}

export default function AuthLayout({ marketingPanel, children, animKey }) {
  return (
    <div className="flex min-h-screen bg-bg-base lg:h-screen lg:overflow-hidden">
      {/* Marketing panel */}
      <div
        className="relative hidden lg:flex lg:flex-col"
        style={{ flex: "0 0 56%" }}
      >
        <MeshBackground />
        <div className="no-scrollbar relative z-10 flex h-full flex-col overflow-y-auto px-10 py-8">
          <div className="mb-12 animate-fade-in">
            <BrandMark />
          </div>
          {marketingPanel}
        </div>
      </div>

      {/* Form panel */}
      <div className="relative flex flex-1 flex-col border-l border-border-subtle bg-bg-surface">
        <div className="flex shrink-0 items-center gap-2.5 px-8 pb-2 pt-6 lg:hidden">
          <BrandMark />
        </div>

        <div className="no-scrollbar flex flex-1 justify-center overflow-y-auto px-6 pb-6 pt-10 sm:px-10 lg:pt-16">
          <div key={animKey} className="w-full max-w-[400px] animate-fade-in">
            {children}
          </div>
        </div>

        <div className="shrink-0 px-8 pb-4 text-center">
          <p className="text-[11px] text-text-disabled">
            © {new Date().getFullYear()} WebMonitor · Real-time uptime &amp;
            incident monitoring
          </p>
        </div>
      </div>
    </div>
  );
}
