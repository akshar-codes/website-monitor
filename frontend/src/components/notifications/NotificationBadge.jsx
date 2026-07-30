import { cn } from "../../utils/cn";

/**
 * Small numeric badge for unread counts — used on the notification bell
 * and reusable anywhere else an unread count needs surfacing (e.g. a
 * future per-category count in a settings list).
 */
export default function NotificationBadge({ count = 0, className }) {
  if (!count || count <= 0) return null;

  const display = count > 99 ? "99+" : count;

  return (
    <span
      className={cn(
        "flex h-4.5 min-w-4.5 items-center justify-center rounded-full border border-bg-base bg-red-500 px-1 text-[10px] font-bold leading-none text-white",
        className,
      )}
    >
      {display}
    </span>
  );
}
