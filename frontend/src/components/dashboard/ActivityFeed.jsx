import { memo, useMemo } from "react";
import { Link } from "react-router-dom";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import { formatResponseTime } from "../../utils/formatters";

const STATUS_COLOR = {
  up: "var(--status-up)",
  down: "var(--status-down)",
  degraded: "var(--status-degraded)",
  unknown: "var(--status-unknown)",
};

function buildActivity(recentChecks, incidents) {
  const checkEvents = (recentChecks || []).map((c, idx) => {
    const monitorId = c.monitor?._id || c.monitor?.id;
    return {
      id: c._id || c.id || `check-${idx}`,
      timestamp: c.checkedAt,
      color: STATUS_COLOR[c.status] || STATUS_COLOR.unknown,
      title: `${c.monitor?.name || "Unknown monitor"} checked`,
      description: `${c.status} · ${formatResponseTime(c.responseTime)}`,
      href: monitorId ? `/monitors/${monitorId}` : null,
    };
  });

  const incidentEvents = (incidents || []).map((i, idx) => {
    const incidentId = i._id || i.id;
    return {
      id: incidentId || `incident-${idx}`,
      timestamp: i.startedAt,
      color: "var(--severity-critical)",
      title: `Incident opened — ${i.monitor?.name || "Unknown monitor"}`,
      description: `${i.severity} severity · ${i.status}`,
      href: incidentId ? `/incidents/${incidentId}` : null,
    };
  });

  return [...checkEvents, ...incidentEvents]
    .filter((e) => e.timestamp)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 10);
}

function ActivityFeed({ recentChecks, incidents }) {
  const activity = useMemo(
    () => buildActivity(recentChecks, incidents),
    [recentChecks, incidents],
  );

  return (
    <div
      id="activity-feed"
      className="rounded-xl p-6"
      style={{
        backgroundColor: "var(--surface-raised)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <h3
        className="text-sm font-semibold mb-4"
        style={{ color: "var(--text-secondary)" }}
      >
        Activity Feed
      </h3>

      {activity.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <WarningAmberRoundedIcon
            sx={{
              fontSize: 28,
              color: "var(--text-tertiary)",
              opacity: 0.6,
              mb: 1,
            }}
          />
          <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>
            No recent activity
          </p>
        </div>
      ) : (
        <ol className="space-y-0">
          {activity.map((item, idx) => {
            const timeLabel = new Date(item.timestamp).toLocaleString(
              undefined,
              {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              },
            );

            const content = (
              <div className="flex-1 min-w-0 pb-4">
                <p
                  className="text-sm font-medium truncate"
                  style={{ color: "var(--text-primary)" }}
                >
                  {item.title}
                </p>
                <p
                  className="text-xs mt-0.5"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {item.description}
                </p>
                <p
                  className="text-[11px] mt-0.5"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {timeLabel}
                </p>
              </div>
            );

            return (
              <li key={item.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span
                    className="rounded-full shrink-0"
                    style={{
                      width: 10,
                      height: 10,
                      backgroundColor: item.color,
                      marginTop: 4,
                    }}
                  />
                  {idx < activity.length - 1 && (
                    <div
                      className="w-px flex-1 my-1"
                      style={{ background: "var(--border)" }}
                    />
                  )}
                </div>
                {item.href ? (
                  <Link
                    to={item.href}
                    style={{ textDecoration: "none", flex: 1, minWidth: 0 }}
                  >
                    {content}
                  </Link>
                ) : (
                  content
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

export default memo(ActivityFeed);
