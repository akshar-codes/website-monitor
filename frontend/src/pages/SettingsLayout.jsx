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
import { useTranslation } from "../i18n";

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
  const t = useTranslation();
  return (
    <div className="settings-route">
      <nav className="settings-nav" aria-label={t("Settings sections")}>
        {links.map(([label, path, Icon]) => (
          <NavLink
            key={path}
            to={path}
            end
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            <Icon size={15} />
            {t(label)}
          </NavLink>
        ))}
      </nav>
      <div className="settings-route-content">
        <Outlet />
      </div>
    </div>
  );
}
