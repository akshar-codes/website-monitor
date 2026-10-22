import { useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Monitor,
  BarChart3,
  AlertTriangle,
  CreditCard,
  Activity as ActivityIcon,
  History,
  ChevronLeft,
  ChevronRight,
  LogOut,
  ShieldOff,
  ShieldCheck,
  Lock,
  ClipboardCheck,
  User,
  SlidersHorizontal,
} from "lucide-react";
import { cn } from "../../utils/cn";
import { useAuth } from "../../hooks/useAuth";
import { usePermissions } from "../../hooks/usePermissions";
import { ROUTES } from "../../constants/routes";
import { PLANS } from "../../constants/plans";
import ConfirmDialog from "../ui/ConfirmDialog";
import PlanBadge from "../ui/PlanBadge";
import UpgradePrompt from "../../features/plans/UpgradePrompt";

const MONITORS_PATH = "/monitors";
const SSL_PATH = ROUTES.SSL_MONITORING;

const BASE_NAV_ITEMS = [
  {
    label: "Dashboard",
    path: "/",
    icon: LayoutDashboard,
    end: true,
  },
  {
    label: "Monitors",
    path: MONITORS_PATH,
    icon: Monitor,
  },
  {
    label: "SSL Monitoring",
    path: SSL_PATH,
    icon: Lock,
  },
  {
    label: "Insights",
    path: "/insights",
    icon: BarChart3,
  },
  {
    label: "Incidents",
    path: ROUTES.INCIDENTS,
    icon: AlertTriangle,
  },
  {
    label: "Activity",
    path: ROUTES.ACTIVITY,
    icon: History,
  },
  {
    label: "Billing",
    path: ROUTES.BILLING,
    icon: CreditCard,
  },
];

const ADMIN_NAV_ITEM = {
  label: "Users",
  path: ROUTES.ADMIN_USERS,
  icon: ShieldCheck,
  permission: "user:read",
};

const ADMIN_PLAN_REQUESTS_NAV_ITEM = {
  label: "Plan Requests",
  path: ROUTES.ADMIN_PLAN_REQUESTS,
  icon: ClipboardCheck,
  permission: "plan-upgrade-request:manage",
};

function NavItem({ item, collapsed }) {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.path}
      end={item.end}
      className={({ isActive }) =>
        cn(
          "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
          "hover:bg-bg-overlay hover:text-white",
          isActive
            ? "bg-[#1a2e22] text-emerald-400 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.15)]"
            : "text-[#71717a]",
          collapsed && "justify-center px-2",
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-emerald-400" />
          )}
          <Icon
            size={18}
            className={cn(
              "shrink-0 transition-colors",
              isActive
                ? "text-emerald-400"
                : "text-text-muted group-hover:text-text-secondary",
            )}
          />
          {!collapsed && <span className="truncate">{item.label}</span>}
          {collapsed && (
            <span className="pointer-events-none absolute left-full ml-2 hidden whitespace-nowrap rounded-md bg-bg-elevated border border-border-default px-2 py-1 text-xs text-white shadow-lg group-hover:block z-50">
              {item.label}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [confirmLogoutAllOpen, setConfirmLogoutAllOpen] = useState(false);
  const [loggingOutAll, setLoggingOutAll] = useState(false);
  const { user, isAdmin, plan, logout, logoutAll } = useAuth();
  const { can } = usePermissions();
  const navigate = useNavigate();

  const navItems = useMemo(() => {
    // Admin accounts are management-only and never own monitors (see
    // backend/src/config/permissions.js) — Monitors and SSL Monitoring
    // are both meaningless for them, so both are hidden alongside each
    // other rather than only the Monitors link.
    const base = isAdmin
      ? BASE_NAV_ITEMS.filter(
          (item) => item.path !== MONITORS_PATH && item.path !== SSL_PATH,
        )
      : BASE_NAV_ITEMS;

    const adminItems = [ADMIN_NAV_ITEM, ADMIN_PLAN_REQUESTS_NAV_ITEM].filter(
      (item) => can(item.permission),
    );

    return [...base, ...adminItems];
  }, [can, isAdmin]);

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      navigate(ROUTES.LOGIN, { replace: true });
    }
  };

  const handleLogoutAll = async () => {
    setLoggingOutAll(true);
    try {
      await logoutAll();
      navigate(ROUTES.LOGIN, { replace: true });
    } finally {
      setLoggingOutAll(false);
      setConfirmLogoutAllOpen(false);
    }
  };

  return (
    <aside
      className={cn(
        "relative flex h-screen flex-col border-r border-border-subtle bg-[#0d0d0f] transition-all duration-200",
        collapsed ? "w-15" : "w-55",
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          "flex items-center border-b border-border-subtle py-4",
          collapsed ? "justify-center px-3" : "gap-3 px-4",
        )}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <ActivityIcon size={16} className="text-emerald-400" />
        </div>
        {!collapsed && (
          <div>
            <p className="text-sm font-semibold text-white leading-tight">
              WebMonitor
            </p>
            <p className="text-[11px] text-text-muted">Uptime Platform</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-4">
        <div className="space-y-0.5">
          {navItems.map((item) => (
            <NavItem key={item.path} item={item} collapsed={collapsed} />
          ))}
        </div>
      </nav>

      {/* Footer — account + sign out */}
      <div
        className={cn("border-t border-border-subtle px-2 py-3 space-y-0.5")}
      >
        <NavLink
          to={`${ROUTES.SETTINGS}/profile`}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-bg-overlay",
              isActive && "bg-bg-overlay",
              collapsed && "justify-center px-2",
            )
          }
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-emerald-500/10 text-[11px] font-bold text-emerald-400">
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name || "Profile avatar"}
                className="h-full w-full object-cover"
              />
            ) : (
              user?.name?.charAt(0)?.toUpperCase() || <User size={14} />
            )}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-xs font-medium text-white">
                  {user?.name || "Account"}
                </p>
                {isAdmin && (
                  <span className="shrink-0 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-400">
                    Admin
                  </span>
                )}
              </div>
              <div className="mt-1 flex items-center gap-1.5">
                <p className="truncate text-[10px] text-text-muted">
                  {user?.email || ""}
                </p>
                <PlanBadge
                  plan={plan}
                  size="sm"
                  showIcon={false}
                  className="shrink-0 px-1.5 py-0"
                />
              </div>
            </div>
          )}
        </NavLink>

        <NavLink
          to={ROUTES.ACCOUNT_SETTINGS}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-bg-overlay",
              isActive ? "bg-bg-overlay text-white" : "text-text-muted",
              collapsed && "justify-center px-2",
            )
          }
        >
          <SlidersHorizontal size={16} className="shrink-0" />
          {!collapsed && <span className="truncate">Settings</span>}
        </NavLink>

        <button
          onClick={handleLogout}
          className={cn(
            "group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[#71717a] transition-all hover:bg-red-500/10 hover:text-red-400",
            collapsed && "justify-center px-2",
          )}
        >
          <LogOut
            size={17}
            className="shrink-0 text-text-muted group-hover:text-red-400"
          />
          {!collapsed && <span className="truncate">Sign out</span>}
        </button>

        {/* Secondary destructive action — kept text-only and low-emphasis
            so it doesn't compete with the primary "Sign out" button.
            Hidden on the collapsed rail; expand the sidebar to access it. */}
        {!collapsed && (
          <button
            onClick={() => setConfirmLogoutAllOpen(true)}
            className="group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium text-text-disabled transition-all hover:bg-red-500/10 hover:text-red-400"
          >
            <ShieldOff
              size={14}
              className="shrink-0 text-text-disabled group-hover:text-red-400"
            />
            <span className="truncate">Sign out of all devices</span>
          </button>
        )}

        {/* Upgrade nudge — only shown to Free-plan, non-admin users (admin
            accounts don't hold their own subscription-relevant usage in
            the way end users do, and are never nudged toward billing
            actions), hidden on the collapsed rail alongside the other
            secondary actions. */}
        {!collapsed && !isAdmin && plan === PLANS.FREE && (
          <UpgradePrompt
            plan={plan}
            variant="compact"
            onUpgradeClick={() => navigate(ROUTES.BILLING)}
            className="mt-1"
          />
        )}

        {/* Version */}
        {!collapsed && (
          <p className="px-3 pt-2 text-[11px] text-text-disabled">v1.0.0</p>
        )}
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="absolute -right-3 top-17 flex h-6 w-6 items-center justify-center rounded-full border border-border-default bg-bg-elevated text-[#71717a] shadow-sm transition-all hover:border-border-strong hover:text-white z-10"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>

      <ConfirmDialog
        open={confirmLogoutAllOpen}
        onClose={() => setConfirmLogoutAllOpen(false)}
        onConfirm={handleLogoutAll}
        title="Sign out of all devices?"
        description="This ends every active session for your account, including this one. You'll need to sign in again everywhere."
        confirmLabel="Sign out everywhere"
        loading={loggingOutAll}
      />
    </aside>
  );
}
