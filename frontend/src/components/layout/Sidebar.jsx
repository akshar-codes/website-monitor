import React, { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Monitor,
  BarChart3,
  Activity,
  ChevronLeft,
  ChevronRight,
  LogOut,
  User,
  Zap,
} from "lucide-react";
import { cn } from "../../utils/cn";

const NAV_ITEMS = [
  {
    label: "Dashboard",
    path: "/",
    icon: LayoutDashboard,
    end: true,
  },
  {
    label: "Monitors",
    path: "/monitors",
    icon: Monitor,
  },
  {
    label: "Insights",
    path: "/insights",
    icon: BarChart3,
  },
];

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
          <Activity size={16} className="text-emerald-400" />
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
          {NAV_ITEMS.map((item) => (
            <NavItem key={item.path} item={item} collapsed={collapsed} />
          ))}
        </div>
      </nav>

      {/* Footer */}
      <div
        className={cn("border-t border-border-subtle px-2 py-3 space-y-0.5")}
      >
        <button
          className={cn(
            "group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[#71717a] transition-all hover:bg-bg-overlay hover:text-white",
            collapsed && "justify-center px-2",
          )}
        >
          <User
            size={17}
            className="shrink-0 text-text-muted group-hover:text-text-secondary"
          />
          {!collapsed && <span className="truncate">Profile</span>}
        </button>

        <button
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
    </aside>
  );
}
