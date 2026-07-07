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
    getValue: (data) => data?.monitors?.total ?? 0,
    getSubtext: (data) =>
      `${data?.monitors?.active ?? 0} active · ${data?.monitors?.inactive ?? 0} paused`,
  },
  {
    key: "active",
    label: "Active Monitors",
    icon: CheckCircleRoundedIcon,
    accent: "var(--status-up)",
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
      className="u-hover-lift relative rounded-xl overflow-hidden"
      style={{
        backgroundColor: "var(--surface-raised)",
        border: "1px solid var(--border)",
        borderLeft: `3px solid ${accent}`,
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <span className="u-eyebrow" style={{ marginBottom: 0 }}>
            {def.label}
          </span>
          <Icon
            sx={{ fontSize: 17, color: "var(--text-tertiary)", opacity: 0.85 }}
          />
        </div>

        <div
          className="text-4xl font-extrabold tracking-tight flex items-baseline gap-1"
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
          className="text-xs mt-2 truncate"
          style={{ color: "var(--text-tertiary)" }}
        >
          {subtext}
        </p>
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
      className="u-stagger grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
    >
      {cards}
    </div>
  );
}

export default memo(AvailabilityCards);
