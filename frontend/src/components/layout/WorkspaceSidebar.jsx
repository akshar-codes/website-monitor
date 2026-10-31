import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Activity,
  Bell,
  ChevronDown,
  CreditCard,
  FileText,
  Gauge,
  KeyRound,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Shield,
  Signal,
  TrendingUp,
  TriangleAlert,
  UserRound,
  Users,
  ClipboardList,
} from "lucide-react";
import { formatPlanName } from "../../utils/formatPlanName";
import { useTranslation } from "../../i18n";

const userLinks = [
  ["Dashboard", "/", LayoutDashboard],
  ["Monitors", "/monitors", Signal],
  ["Incidents", "/incidents", TriangleAlert],
  ["Insights", "/insights", TrendingUp],
  ["SSL Monitoring", "/ssl", Shield],
  ["Reports", "/activity", FileText],
];

const adminLinks = [
  ["Overview", "/admin", LayoutDashboard],
  ["Users", "/admin/users", Users],
  ["Monitors", "/admin/monitors", Signal],
  ["Incidents", "/admin/incidents", TriangleAlert],
  ["Plans", "/admin/plans", CreditCard],
  ["Plan requests", "/admin/plan-requests", ClipboardList],
  ["Audit logs", "/admin/audit-logs", FileText],
];

const accountLinks = [
  ["Account", "/settings/account", UserRound],
  ["Profile", "/settings/profile", UserRound],
  ["Security", "/settings/security", LockKeyhole],
  ["Notifications", "/settings/notifications", Bell],
  ["API keys", "/settings/api-keys", KeyRound],
  ["Preferences", "/settings/preferences", Gauge],
  ["Billing", "/billing", CreditCard],
];

export default function WorkspaceSidebar({
  collapsed,
  onToggle,
  onNavigate,
  user,
  isAdmin = false,
  incidentCount = 0,
  onSignOut,
}) {
  const t = useTranslation();
  const location = useLocation();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileWrapRef = useRef(null);
  const links = isAdmin ? adminLinks : userLinks;
  const isActive = (href) =>
    href === "/" || href === "/admin"
      ? location.pathname === href
      : location.pathname === href || location.pathname.startsWith(`${href}/`);
  const accountAreaActive = accountLinks.some(([, href]) => isActive(href));
  const closeMenus = () => {
    setProfileMenuOpen(false);
    onNavigate?.();
  };

  useEffect(() => {
    if (!profileMenuOpen) return undefined;
    const closeOnOutsideClick = (event) => {
      if (!profileWrapRef.current?.contains(event.target)) {
        setProfileMenuOpen(false);
      }
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setProfileMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [profileMenuOpen]);

  return (
    <aside className="site-sidebar">
      <div className="sidebar-brand-row">
        <Link
          className="brand"
          to={isAdmin ? "/admin" : "/"}
          aria-label="SiteWatch home"
          onClick={closeMenus}
        >
          <span className="brand-mark">
            <Activity size={24} strokeWidth={2.8} />
          </span>
          <span>
            <b>{isAdmin ? "SiteWatch Admin" : "SiteWatch"}</b>
            <small>{isAdmin ? "Administration" : "Website Monitoring"}</small>
          </span>
        </Link>
        <button
          className="sidebar-toggle"
          onClick={onToggle}
          aria-label={t(
            collapsed ? "Expand navigation" : "Collapse navigation",
          )}
          title={t(collapsed ? "Expand navigation" : "Collapse navigation")}
        >
          {collapsed ? (
            <PanelLeftOpen size={18} />
          ) : (
            <PanelLeftClose size={18} />
          )}
        </button>
      </div>

      <nav className="side-nav" aria-label={t("Main navigation")}>
        {links.map(([label, href, Icon]) => (
          <Link
            key={href}
            className={`nav-link ${isActive(href) ? "selected" : ""}`}
            to={href}
            onClick={closeMenus}
            title={collapsed ? t(label) : undefined}
            aria-current={isActive(href) ? "page" : undefined}
          >
            <Icon size={18} />
            <span>{t(label)}</span>
            {label === "Incidents" && incidentCount > 0 && (
              <b className="nav-count">{incidentCount}</b>
            )}
          </Link>
        ))}
      </nav>

      <div className="sidebar-profile-wrap" ref={profileWrapRef}>
        {profileMenuOpen && (
          <div
            className="profile-menu"
            role="menu"
            aria-label={t("Account menu")}
          >
            <div className="profile-menu-heading">
              <span className="avatar">{user?.name?.[0] || "A"}</span>
              <span>
                <b>{user?.name || "Account"}</b>
                <small>
                  {user?.email || user?.plan || t("Manage your account")}
                </small>
              </span>
            </div>
            {accountLinks.map(([label, href, Icon]) => (
              <Link
                key={href}
                className={`profile-menu-link ${isActive(href) ? "selected" : ""}`}
                to={href}
                role="menuitem"
                onClick={closeMenus}
              >
                <Icon size={16} />
                <span>{t(label)}</span>
              </Link>
            ))}
            <button
              className="profile-menu-link signout-link"
              role="menuitem"
              onClick={() => {
                closeMenus();
                onSignOut?.();
              }}
            >
              <LogOut size={16} />
              <span>{t("Sign out")}</span>
            </button>
          </div>
        )}
        <button
          className={`sidebar-profile profile-button${accountAreaActive ? " selected" : ""}`}
          aria-haspopup="menu"
          aria-expanded={profileMenuOpen}
          onClick={() => setProfileMenuOpen((open) => !open)}
          title={collapsed ? user?.name || "Account" : undefined}
        >
          <span className="avatar">{user?.name?.[0] || "A"}</span>
          <span>
            <b>{user?.name || "Account"}</b>
            <small>
              {formatPlanName(
                user?.plan || (isAdmin ? "Administrator" : "free"),
              )}
            </small>
          </span>
          <ChevronDown size={15} />
        </button>
      </div>
    </aside>
  );
}
