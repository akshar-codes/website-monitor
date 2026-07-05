import { memo } from "react";
import InboxRoundedIcon from "@mui/icons-material/InboxRounded";

function EmptyState({
  icon,
  title = "No data found",
  message = "There are no items to display right now.",
  action,
}) {
  return (
    <div
      id="empty-state"
      className="animate-fade-in flex flex-col items-center justify-center py-16 px-6 text-center"
    >
      {/* Icon */}
      <div
        className="mb-5 flex items-center justify-center rounded-full"
        style={{
          width: 72,
          height: 72,
          backgroundColor: "var(--primary-light)",
          color: "var(--text-tertiary)",
        }}
      >
        {icon || <InboxRoundedIcon sx={{ fontSize: 36, opacity: 0.6 }} />}
      </div>

      {/* Title */}
      <h3
        className="text-lg font-semibold mb-1.5"
        style={{ color: "var(--text-primary)" }}
      >
        {title}
      </h3>

      {/* Message */}
      <p
        className="text-sm max-w-xs mb-6 leading-relaxed"
        style={{ color: "var(--text-tertiary)" }}
      >
        {message}
      </p>

      {/* Optional action */}
      {action && <div>{action}</div>}
    </div>
  );
}

export default memo(EmptyState);
