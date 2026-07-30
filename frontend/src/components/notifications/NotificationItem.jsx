import { Link } from "react-router-dom";
import {
  Monitor,
  AlertTriangle,
  CreditCard,
  UserCircle,
  Megaphone,
  Trash2,
  Check,
} from "lucide-react";
import { formatRelative } from "../../utils/format";
import { cn } from "../../utils/cn";

const CATEGORY_CONFIG = {
  monitor: { icon: Monitor, bg: "bg-blue-500/10", text: "text-blue-400" },
  incident: { icon: AlertTriangle, bg: "bg-red-500/10", text: "text-red-400" },
  billing: {
    icon: CreditCard,
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
  },
  account: { icon: UserCircle, bg: "bg-amber-500/10", text: "text-amber-400" },
  system: { icon: Megaphone, bg: "bg-zinc-500/10", text: "text-zinc-400" },
};

export default function NotificationItem({
  notification,
  onMarkRead,
  onDelete,
  submitting = false,
  compact = false,
}) {
  const config = CATEGORY_CONFIG[notification.category] || CATEGORY_CONFIG.system;
  const Icon = config.icon;

  const content = (
    <div
      className={cn(
        "group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-[#131315]",
        !notification.read && "bg-emerald-500/[0.03]",
      )}
    >
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
          config.bg,
        )}
      >
        <Icon size={15} className={config.text} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p
            className={cn(
              "text-sm leading-snug",
              notification.read
                ? "text-text-secondary"
                : "font-semibold text-white",
            )}
          >
            {notification.title}
          </p>
          {!notification.read && (
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
          )}
        </div>
        <p
          className={cn(
            "mt-0.5 text-xs leading-relaxed text-text-muted",
            compact && "line-clamp-2",
          )}
        >
          {notification.message}
        </p>
        <p className="mt-1 text-[11px] text-text-disabled">
          {formatRelative(notification.createdAt)}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        {!notification.read && onMarkRead && (
          <button
            type="button"
            disabled={submitting}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onMarkRead(notification.id);
            }}
            aria-label="Mark as read"
            title="Mark as read"
            className="flex h-6 w-6 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-bg-subtle hover:text-emerald-400 disabled:pointer-events-none disabled:opacity-40"
          >
            <Check size={13} />
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            disabled={submitting}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete(notification.id);
            }}
            aria-label="Delete notification"
            title="Delete"
            className="flex h-6 w-6 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:pointer-events-none disabled:opacity-40"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </div>
  );

  if (!notification.link) {
    return (
      <div className="border-b border-[#1a1a1d] last:border-0">{content}</div>
    );
  }

  return (
    <Link
      to={notification.link}
      onClick={() => {
        if (!notification.read && onMarkRead) onMarkRead(notification.id);
      }}
      className="block border-b border-[#1a1a1d] last:border-0"
    >
      {content}
    </Link>
  );
}
