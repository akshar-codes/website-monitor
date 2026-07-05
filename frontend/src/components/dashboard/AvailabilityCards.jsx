import { memo, useMemo } from "react";
import DnsRoundedIcon from "@mui/icons-material/DnsRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import PauseCircleRoundedIcon from "@mui/icons-material/PauseCircleRounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import AnimatedNumber from "./AnimatedNumber";

function getUptimeColor(pct) {
  if (pct == null) return "var(--text-tertiary)";
  if (pct >= 99.9) return "var(--status-up)";
  if (pct >= 99) return "var(--status-degraded)";
  return "var(--status-down)";
}

const CARD_DEFS = [
  {
    key: "total",
    label: "Total Monitors",
    icon: DnsRoundedIcon,
    accent: "var(--primary)",
    accentBg: "var(--primary-light)",
    getValue: (data) => data?.monitors?.total ?? 0,
    getSubtext: (data) =>
      `${data?.monitors?.active ?? 0} active · ${data?.monitors?.inactive ?? 0} paused`,
  },
  {
    key: "active",
    label: "Active Monitors",
    icon: CheckCircleRoundedIcon,
    accent: "var(--status-up)",
    accentBg: "var(--status-up-bg)",
    getValue: (data) => data?.monitors?.active ?? 0,
    getSubtext: (data) => {
      const total = data?.monitors?.total ?? 0;
      const active = data?.monitors?.active ?? 0;
      const pct = total > 0 ? Math.round((active / total) * 100) : 0;
      return `${pct}% of fleet monitoring`;
    },
  },
  {
    key: "uptime",
    label: "System Uptime",
    icon: TrendingUpRoundedIcon,
    accent: null,
    accentBg: "var(--primary-light)",
    isPercentage: true,
    getValue: (data) => data?.uptime?.percentage ?? 0,
    getSubtext: (data) =>
      `${(data?.uptime?.totalChecks ?? 0).toLocaleString()} checks · last 24h`,
  },
  {
    key: "paused",
    label: "Paused Monitors",
    icon: PauseCircleRoundedIcon,
    accent: "var(--text-tertiary)",
    accentBg: "var(--status-unknown-bg)",
    getValue: (data) => data?.monitors?.inactive ?? 0,
    getSubtext: () => "Not currently polling",
  },
];

function AvailabilityCard({ def, data }) {
  const value = def.getValue(data);
  const subtext = def.getSubtext(data);
  const Icon = def.icon;
  const accent = def.isPercentage ? getUptimeColor(value) : def.accent;

  return (
    <div
      id={`availability-card-${def.key}`}
      className="rounded-xl overflow-hidden"
      style={{
        backgroundColor: "var(--surface-raised)",
        border: "1px solid var(--border)",
        borderLeft: `4px solid ${accent}`,
        boxShadow: "var(--shadow-sm)",
        transition:
          "box-shadow var(--transition-base), transform var(--transition-base)",
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
      <div className="p-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className="text-xs font-semibold uppercase tracking-wide mb-2 truncate"
            style={{ color: "var(--text-tertiary)" }}
          >
            {def.label}
          </p>
          <div
            className="text-3xl font-bold tracking-tight flex items-baseline gap-1"
            style={{ color: "var(--text-primary)" }}
          >
            <AnimatedNumber value={value} decimals={def.isPercentage ? 2 : 0} />
            {def.isPercentage && (
              <span className="text-lg font-semibold" style={{ color: accent }}>
                %
              </span>
            )}
          </div>
          <p
            className="text-xs mt-1.5 truncate"
            style={{ color: "var(--text-tertiary)" }}
          >
            {subtext}
          </p>
        </div>
        <div
          className="flex items-center justify-center rounded-xl shrink-0"
          style={{ width: 44, height: 44, backgroundColor: def.accentBg }}
        >
          <Icon sx={{ fontSize: 22, color: accent }} />
        </div>
      </div>
    </div>
  );
}

function AvailabilityCards({ data }) {
  const cards = useMemo(
    () =>
      CARD_DEFS.map((def) => (
        <AvailabilityCard key={def.key} def={def} data={data} />
      )),
    [data],
  );

  return (
    <div
      id="availability-cards"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
    >
      {cards}
    </div>
  );
}

export default memo(AvailabilityCards);
