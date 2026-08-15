import { AlertTriangle, XCircle } from "lucide-react";
import { cn } from "../../utils/cn";
import { SSL_STATUS } from "../../constants/ssl";

const COPY = {
  [SSL_STATUS.EXPIRED]: {
    icon: XCircle,
    tone: "danger",
    title: "SSL certificate has expired",
  },
  [SSL_STATUS.EXPIRING_SOON]: {
    icon: AlertTriangle,
    tone: "warning",
    title: "SSL certificate is expiring soon",
  },
  [SSL_STATUS.INVALID]: {
    icon: XCircle,
    tone: "danger",
    title: "SSL certificate is invalid",
  },
  [SSL_STATUS.UNREACHABLE]: {
    icon: AlertTriangle,
    tone: "danger",
    title: "Could not reach the server to check SSL",
  },
};

const TONE_CLASSES = {
  danger: "border-red-500/20 bg-red-500/10 text-red-300",
  warning: "border-amber-500/20 bg-amber-500/10 text-amber-200",
};

/**
 * Inline warning banner for a monitor's SSL status — renders nothing for
 * healthy/pending/not-applicable states so callers can mount it
 * unconditionally without a guard clause at every call site.
 */
export default function SslWarningAlert({ status, daysRemaining, className }) {
  const copy = COPY[status];
  if (!copy) return null;

  const Icon = copy.icon;
  const dayText =
    daysRemaining != null
      ? daysRemaining < 0
        ? ` — expired ${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) === 1 ? "" : "s"} ago`
        : ` — ${daysRemaining} day${daysRemaining === 1 ? "" : "s"} remaining`
      : "";

  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm",
        TONE_CLASSES[copy.tone],
        className,
      )}
    >
      <Icon size={16} className="mt-0.5 shrink-0" />
      <span>
        {copy.title}
        {dayText}
      </span>
    </div>
  );
}
