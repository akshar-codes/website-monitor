import { memo, useMemo } from "react";
import DnsRoundedIcon from "@mui/icons-material/DnsRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import PauseCircleRoundedIcon from "@mui/icons-material/PauseCircleRounded";
import WarningRoundedIcon from "@mui/icons-material/WarningRounded";
import { formatNumber } from "../../utils/formatters";

const CARD_CONFIGS = [
  {
    key: "total",
    label: "Total Monitors",
    icon: DnsRoundedIcon,
    accentColor: "var(--primary)",
    accentBg: "var(--primary-light)",
    getValue: (data) => data?.monitors?.total ?? 0,
  },
  {
    key: "active",
    label: "Active",
    icon: CheckCircleRoundedIcon,
    accentColor: "var(--status-up)",
    accentBg: "var(--status-up-bg)",
    getValue: (data) => data?.monitors?.active ?? 0,
  },
  {
    key: "inactive",
    label: "Inactive",
    icon: PauseCircleRoundedIcon,
    accentColor: "var(--text-tertiary)",
    accentBg: "var(--status-unknown-bg)",
    getValue: (data) => data?.monitors?.inactive ?? 0,
  },
  {
    key: "incidents",
    label: "Active Incidents",
    icon: WarningRoundedIcon,
    accentColor: "var(--status-down)",
    accentBg: "var(--status-down-bg)",
    getValue: (data) => data?.activeIncidents?.count ?? 0,
    pulse: (data) => (data?.activeIncidents?.count ?? 0) > 0,
  },
];

function StatusCard({ config, data }) {
  const value = config.getValue(data);
  const shouldPulse = config.pulse?.(data);
  const Icon = config.icon;

  return (
    <div
      id={`status-card-${config.key}`}
      className="relative rounded-xl overflow-hidden"
      style={{
        backgroundColor: "var(--surface-raised)",
        border: "1px solid var(--border)",
        borderLeftWidth: 4,
        borderLeftColor: config.accentColor,
        boxShadow: "var(--shadow-sm)",
        transition:
          "box-shadow var(--transition-base), transform var(--transition-base)",
        cursor: "default",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = "var(--shadow-md)";
        e.currentTarget.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "var(--shadow-sm)";
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      <div className="p-5 flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p
            className="text-sm font-medium mb-2 truncate"
            style={{ color: "var(--text-secondary)" }}
          >
            {config.label}
          </p>
          <p
            className="text-3xl font-bold tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            {formatNumber(value)}
          </p>
        </div>
        <div
          className="relative flex items-center justify-center rounded-xl shrink-0"
          style={{
            width: 44,
            height: 44,
            backgroundColor: config.accentBg,
          }}
        >
          {shouldPulse && (
            <span
              className="absolute inset-0 rounded-xl"
              style={{
                backgroundColor: config.accentColor,
                opacity: 0.2,
                animation:
                  "pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
              }}
            />
          )}
          <Icon sx={{ fontSize: 24, color: config.accentColor }} />
        </div>
      </div>
    </div>
  );
}

function StatusCardGrid({ data }) {
  const cards = useMemo(
    () =>
      CARD_CONFIGS.map((config) => (
        <StatusCard key={config.key} config={config} data={data} />
      )),
    [data],
  );

  return (
    <div
      id="status-card-grid"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
    >
      {cards}
    </div>
  );
}

export default memo(StatusCardGrid);
