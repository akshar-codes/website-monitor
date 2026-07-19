import { Loader2, CheckCircle2, XCircle } from "lucide-react";

const STATUS_CONFIG = {
  pending: {
    icon: Loader2,
    iconClassName: "text-emerald-400 animate-spin",
    iconBg: "bg-emerald-500/10 border-emerald-500/20",
    title: "Verifying your email…",
  },
  success: {
    icon: CheckCircle2,
    iconClassName: "text-emerald-400",
    iconBg: "bg-emerald-500/10 border-emerald-500/20",
    title: "Email verified",
  },
  failed: {
    icon: XCircle,
    iconClassName: "text-red-400",
    iconBg: "bg-red-500/10 border-red-500/20",
    title: "Verification failed",
  },
};

/**
 * Shared visual shell for every email-verification state — used on the
 * post-registration "check your inbox" screen, the token-confirmation
 * page (pending/success/failed), and anywhere else that flow surfaces.
 */
export default function VerificationStatusCard({
  status,
  title,
  message,
  children,
}) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.failed;
  const Icon = config.icon;

  return (
    <div className="flex flex-col items-center rounded-2xl border border-border-subtle bg-bg-surface px-8 py-10 text-center">
      <div
        className={`mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border ${config.iconBg}`}
      >
        <Icon size={26} className={config.iconClassName} />
      </div>
      <h2 className="mb-2 text-xl font-semibold tracking-tight text-white">
        {title || config.title}
      </h2>
      {message && (
        <p className="mb-2 max-w-sm text-sm leading-relaxed text-text-secondary">
          {message}
        </p>
      )}
      {children && <div className="mt-4 w-full">{children}</div>}
    </div>
  );
}
