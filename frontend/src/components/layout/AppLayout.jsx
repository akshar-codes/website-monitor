import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Bell, Menu, X } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { useNotificationsCenter } from "../../hooks/useNotifications";
import { useSidebarLayout } from "../../hooks/useSidebarLayout";
import OmniSearch from "./OmniSearch";
import WorkspaceSidebar from "./WorkspaceSidebar";

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAdmin, logout } = useAuth();
  const { unreadTotal } = useNotificationsCenter();
  const { collapsed, mobileOpen, toggle, closeMobile } = useSidebarLayout();

  if (location.pathname === "/") return <Outlet />;

  return (
    <div
      className={`site-shell app-shell${collapsed ? " sidebar-collapsed" : ""}${mobileOpen ? " mobile-sidebar-open" : ""}`}
    >
      {mobileOpen && (
        <button
          className="sidebar-backdrop"
          aria-label="Close navigation menu"
          onClick={closeMobile}
        />
      )}
      <WorkspaceSidebar
        collapsed={collapsed}
        onToggle={toggle}
        onNavigate={closeMobile}
        user={user}
        isAdmin={isAdmin}
        onSignOut={async () => {
          await logout();
          navigate("/login", { replace: true });
        }}
      />
      <div className="site-workspace">
        <header className="site-topbar">
          <button
            className="mobile-menu-toggle"
            onClick={toggle}
            aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
          >
            {mobileOpen ? <X size={19} /> : <Menu size={19} />}
          </button>
          <OmniSearch />
          <div className="topbar-actions">
            <Link
              className={`notification-button${location.pathname === "/notifications" ? " selected" : ""}`}
              to={isAdmin ? "/admin/audit-logs" : "/notifications"}
              aria-label={`${unreadTotal} unread notifications`}
              aria-current={
                location.pathname === "/notifications" ? "page" : undefined
              }
            >
              <Bell size={18} />
              {!isAdmin && unreadTotal > 0 && <i />}
            </Link>
          </div>
        </header>
        <div className="app-route-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
