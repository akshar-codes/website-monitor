import { memo } from "react";
import Tooltip from "@mui/material/Tooltip";
import { useServerHealth } from "../../hooks/queries/useServerHealth";

function ServerHealthIndicator({ collapsed = false }) {
  const { data, isLoading, isError } = useServerHealth();

  const dotColor = isLoading
    ? "bg-gray-400"
    : isError
      ? "bg-red-500"
      : "bg-emerald-500";

  const statusText = isLoading
    ? "Checking server..."
    : isError
      ? "Server unreachable"
      : `Server healthy — ${data?.environment ?? "unknown"} • Uptime: ${Math.floor((data?.uptime ?? 0) / 3600)}h`;

  return (
    <Tooltip title={statusText} placement="right" arrow>
      <div
        id="server-health-indicator"
        className={`flex items-center gap-2.5 px-4 py-3 cursor-default select-none ${
          collapsed ? "justify-center px-0" : ""
        }`}
      >
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          {!isLoading && !isError && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          )}
          <span
            className={`relative inline-flex h-2.5 w-2.5 rounded-full ${dotColor}`}
          />
        </span>
        {!collapsed && (
          <span className="text-xs text-gray-400 truncate">
            {isLoading
              ? "Connecting..."
              : isError
                ? "Disconnected"
                : "Server Online"}
          </span>
        )}
      </div>
    </Tooltip>
  );
}

export default memo(ServerHealthIndicator);
