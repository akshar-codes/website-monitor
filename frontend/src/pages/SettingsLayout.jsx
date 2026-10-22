import { NavLink, Outlet } from "react-router-dom";
import {
  CircleUserRound,
  UserRound,
  SlidersHorizontal,
  Settings as SettingsIcon,
  ShieldCheck,
  Bell,
  KeyRound,
} from "lucide-react";
import { cn } from "../utils/cn";

const sections = [
  { label: "Account", path: "/settings/account", icon: CircleUserRound },
  { label: "Profile", path: "/settings/profile", icon: UserRound },
  {
    label: "Preferences",
    path: "/settings/preferences",
    icon: SlidersHorizontal,
  },
  { label: "Security", path: "/settings/security", icon: ShieldCheck },
  { label: "Notifications", path: "/settings/notifications", icon: Bell },
  { label: "API keys", path: "/settings/api-keys", icon: KeyRound },
];

export default function SettingsLayout() {
  return (
    <main className="flex-1 overflow-y-auto bg-bg-base px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-350">
        <header className="mb-6">
          <div className="flex items-center gap-2 text-emerald-400">
            <SettingsIcon size={17} />
            <span className="text-xs font-semibold uppercase tracking-widest">
              Settings
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">
            Settings dashboard
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            Manage your account, profile, security, and notifications.
          </p>
        </header>
        <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
          <nav
            aria-label="Settings sections"
            className="flex gap-1 overflow-x-auto rounded-xl border border-border-subtle bg-bg-surface p-2 lg:flex-col lg:self-start"
          >
            {sections.map(({ label, path, icon: Icon }) => (
              <NavLink
                key={path}
                to={path}
                className={({ isActive }) =>
                  cn(
                    "flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-[#1a2e22] text-emerald-400"
                      : "text-text-muted hover:bg-bg-overlay hover:text-white",
                  )
                }
              >
                <Icon size={16} />
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="min-w-0">
            <Outlet />
          </div>
        </div>
      </div>
    </main>
  );
}
