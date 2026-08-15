import { ShieldCheck, ShieldAlert, XCircle, Gauge } from "lucide-react";
import StatCard from "../../components/cards/StatCard";
import { SSL_STATUS } from "../../constants/ssl";

export default function SslOverviewStats({ overview, loading }) {
  const statusCounts = overview?.statusCounts || {};
  const totals = overview?.totals || {};

  const expiredOrInvalidCount =
    (statusCounts[SSL_STATUS.EXPIRED] ?? 0) +
    (statusCounts[SSL_STATUS.INVALID] ?? 0) +
    (statusCounts[SSL_STATUS.UNREACHABLE] ?? 0);

  const cards = [
    {
      label: "Monitored",
      value: totals.monitoredCount ?? "—",
      description: `of ${totals.eligibleMonitors ?? 0} HTTPS monitors`,
      icon: Gauge,
      iconColor: "text-text-secondary",
      iconBg: "bg-bg-overlay",
    },
    {
      label: "Valid Certificates",
      value: statusCounts[SSL_STATUS.VALID] ?? 0,
      description: "Healthy and up to date",
      icon: ShieldCheck,
      iconColor: "text-emerald-400",
      iconBg: "bg-emerald-500/10",
    },
    {
      label: "Expiring Soon",
      value: statusCounts[SSL_STATUS.EXPIRING_SOON] ?? 0,
      description: "Within the warning window",
      icon: ShieldAlert,
      iconColor: "text-amber-400",
      iconBg: "bg-amber-500/10",
      accent:
        (statusCounts[SSL_STATUS.EXPIRING_SOON] ?? 0) > 0 ? "text-amber-400" : "text-white",
    },
    {
      label: "Expired / Invalid",
      value: expiredOrInvalidCount,
      description: `${statusCounts[SSL_STATUS.EXPIRED] ?? 0} expired · ${statusCounts[SSL_STATUS.INVALID] ?? 0} invalid`,
      icon: XCircle,
      iconColor: "text-red-400",
      iconBg: "bg-red-500/10",
      accent: expiredOrInvalidCount > 0 ? "text-red-400" : "text-white",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((card) => (
        <StatCard key={card.label} {...card} loading={loading} />
      ))}
    </div>
  );
}
