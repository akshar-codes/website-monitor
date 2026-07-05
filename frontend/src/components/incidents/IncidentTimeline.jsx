import { memo } from "react";
import RelativeTime from "../shared/RelativeTime";
import { formatDuration } from "../../utils/formatters";

const stages = [
  {
    key: "started",
    label: "Started",
    field: "startedAt",
    color: "var(--status-down)",
    icon: "🔴",
  },
  {
    key: "investigating",
    label: "Investigating",
    status: "investigating",
    color: "var(--status-degraded)",
    icon: "🔍",
  },
  {
    key: "identified",
    label: "Identified",
    status: "identified",
    color: "var(--severity-major)",
    icon: "🔎",
  },
  {
    key: "resolved",
    label: "Resolved",
    field: "endedAt",
    color: "var(--status-up)",
    icon: "✅",
  },
];

function IncidentTimeline({ incident }) {
  if (!incident) return null;

  const statusOrder = ["ongoing", "investigating", "identified", "resolved"];
  const currentIdx = statusOrder.indexOf(incident.status);

  const activeStages = stages.filter((stage) => {
    if (stage.field === "startedAt") return true;
    if (stage.field === "endedAt") return incident.endedAt != null;
    if (stage.status) return statusOrder.indexOf(stage.status) <= currentIdx;
    return false;
  });

  return (
    <div
      className="rounded-xl p-6"
      style={{
        background: "var(--surface-raised)",
        border: "1px solid var(--border)",
      }}
    >
      <h3
        className="text-sm font-semibold mb-6"
        style={{ color: "var(--text-secondary)" }}
      >
        Incident Timeline
      </h3>
      <div className="space-y-0">
        {activeStages.map((stage, i) => {
          const time =
            stage.field === "startedAt"
              ? incident.startedAt
              : stage.field === "endedAt"
                ? incident.endedAt
                : null;
          const prevTime =
            i > 0
              ? activeStages[i - 1].field === "startedAt"
                ? incident.startedAt
                : incident.endedAt
              : null;

          return (
            <div key={stage.key} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0"
                  style={{ background: stage.color, color: "white" }}
                >
                  {stage.icon}
                </div>
                {i < activeStages.length - 1 && (
                  <div
                    className="w-0.5 flex-1 my-1 min-h-[32px]"
                    style={{ background: "var(--border)" }}
                  />
                )}
              </div>
              <div className="flex-1 pb-6">
                <div
                  className="font-medium text-sm"
                  style={{ color: "var(--text-primary)" }}
                >
                  {stage.label}
                </div>
                {time && (
                  <div
                    className="text-xs mt-0.5"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    <RelativeTime date={time} />
                  </div>
                )}
                {i > 0 && prevTime && time && (
                  <div
                    className="text-xs mt-1 px-2 py-0.5 rounded inline-block"
                    style={{
                      background: "var(--primary-light)",
                      color: "var(--primary)",
                    }}
                  >
                    +{formatDuration(prevTime, time)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default memo(IncidentTimeline);
