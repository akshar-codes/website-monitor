import NotificationDropdown from "../notifications/NotificationDropdown";

/**
 * Slim top bar hosting global, cross-page controls — currently just the
 * notification bell. Kept as its own component (rather than folded
 * directly into AppLayout) so future additions (global search,
 * breadcrumbs) have an obvious home.
 */
export default function TopBar() {
  return (
    <header className="flex h-14 shrink-0 items-center justify-end border-b border-border-subtle bg-bg-base px-6">
      <NotificationDropdown />
    </header>
  );
}
