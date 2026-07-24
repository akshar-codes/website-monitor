import { ShieldAlert } from "lucide-react";
import Button from "../ui/Button";

/**
 * Generic full-panel "you can't be here" state, parameterized so it can
 * represent both a role-based denial (pages/Unauthorized.jsx) and a
 * plan-based denial (pages/UpgradeRequired.jsx) without duplicating the
 * layout twice.
 */
export default function AccessDenied({
  icon: Icon = ShieldAlert,
  iconClassName = "text-red-400",
  iconBg = "border-red-500/20 bg-red-500/10",
  title = "Access denied",
  message = "You don't have permission to view this page. If you believe this is a mistake, contact an administrator.",
  actionLabel = "Back to dashboard",
  onAction,
}) {
  return (
    <div className="flex flex-1 items-center justify-center bg-bg-base px-6">
      <div className="flex max-w-sm flex-col items-center text-center">
        <div
          className={`mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border ${iconBg}`}
        >
          <Icon size={26} className={iconClassName} />
        </div>
        <h1 className="mb-2 text-xl font-semibold tracking-tight text-white">
          {title}
        </h1>
        <p className="mb-6 text-sm leading-relaxed text-text-secondary">
          {message}
        </p>
        {onAction && (
          <Button variant="primary" size="md" onClick={onAction}>
            {actionLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
