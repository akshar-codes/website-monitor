import { memo } from "react";
import { useServerHealth } from "../../hooks/queries/useServerHealth";

function Footer() {
  const { isError, isLoading } = useServerHealth();

  const statusColor = isLoading
    ? "var(--status-unknown)"
    : isError
      ? "var(--status-down)"
      : "var(--status-up)";

  const statusLabel = isLoading
    ? "Checking status…"
    : isError
      ? "Server unreachable"
      : "All systems operational";

  return (
    <footer
      id="app-footer"
      className="shrink-0 flex flex-col sm:flex-row items-center justify-between gap-2 px-4 md:px-6 lg:px-8 py-4 text-xs"
      style={{
        borderTop: "1px solid var(--border)",
        color: "var(--text-tertiary)",
      }}
    >
      <span>© {new Date().getFullYear()} WebMon. All rights reserved.</span>

      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block rounded-full"
            style={{ width: 6, height: 6, background: statusColor }}
          />
          {statusLabel}
        </span>
        <span>v1.0.0</span>
      </div>
    </footer>
  );
}

export default memo(Footer);
