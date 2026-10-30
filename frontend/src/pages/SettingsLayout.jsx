import { NavLink, Outlet } from "react-router-dom";
import {
  UserRound,
  UserCircle,
  CreditCard,
  SlidersHorizontal,
  LockKeyhole,
  Bell,
  KeyRound,
} from "lucide-react";

const links = [
  ["Account", "account", UserRound],
  ["Profile", "profile", UserCircle],
  ["Subscription", "subscription", CreditCard],
  ["Preferences", "preferences", SlidersHorizontal],
  ["Security", "security", LockKeyhole],
  ["Notifications", "notifications", Bell],
  ["API keys", "api-keys", KeyRound],
];

export default function SettingsLayout() {
  return (
    <div className="settings-route">
      <nav className="settings-nav" aria-label="Settings sections">
        {links.map(([label, path, Icon]) => (
          <NavLink
            key={path}
            to={path}
            end
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            <Icon size={15} />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="settings-route-content">
        <Outlet />
      </div>
    </div>
  );
}
