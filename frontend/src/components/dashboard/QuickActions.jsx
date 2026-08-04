import { useNavigate } from "react-router-dom";
import { Plus, BarChart3, CreditCard } from "lucide-react";
import { ROUTES } from "../../constants/routes";
import { useAuth } from "../../hooks/useAuth";

const ACTIONS = [
  {
    label: "Add Monitor",
    description: "Track a new website or endpoint",
    icon: Plus,
    to: ROUTES.MONITORS,
    adminOnly: false,
    hideFromAdmin: true,
  },
  {
    label: "View Insights",
    description: "Trends, uptime, and incident history",
    icon: BarChart3,
    to: ROUTES.INSIGHTS,
  },
  {
    label: "Manage Billing",
    description: "Plan usage and upgrade options",
    icon: CreditCard,
    to: ROUTES.BILLING,
  },
];

export default function QuickActions() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  // Admin accounts are management-only and cannot create monitors (see
  // backend/src/config/permissions.js and services/monitor.service.js) —
  // the /monitors route itself is also blocked for them (see
  // components/routing/BlockRoleRoute.jsx in App.jsx), so this CTA would
  // otherwise link to an unreachable page.
  const actions = isAdmin
    ? ACTIONS.filter((action) => !action.hideFromAdmin)
    : ACTIONS;

  return (
    <div className="rounded-xl border border-border-subtle bg-bg-surface p-5">
      <p className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-text-muted">
        Quick Actions
      </p>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={() => navigate(action.to)}
            className="group flex items-center gap-3 rounded-lg border border-border-default bg-bg-elevated px-4 py-3 text-left transition-colors hover:border-emerald-500/30 hover:bg-[#131315] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 transition-colors group-hover:bg-emerald-500/15">
              <action.icon size={16} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">
                {action.label}
              </p>
              <p className="truncate text-[11px] text-text-muted">
                {action.description}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
