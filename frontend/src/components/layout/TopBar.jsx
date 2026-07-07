import { memo, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import MenuIcon from "@mui/icons-material/Menu";
import RefreshIcon from "@mui/icons-material/Refresh";
import LightModeIcon from "@mui/icons-material/LightMode";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import ComputerIcon from "@mui/icons-material/Computer";
import { useUI } from "../../providers/UIProvider";
import Breadcrumbs from "./Breadcrumbs";
import GlobalSearch from "./GlobalSearch";
import NotificationDropdown from "./NotificationDropdown";
import UserDropdown from "./UserDropdown";

const THEME_META = {
  system: { icon: ComputerIcon, label: "Theme: System" },
  light: { icon: LightModeIcon, label: "Theme: Light" },
  dark: { icon: DarkModeIcon, label: "Theme: Dark" },
};

function getMobileTitle(pathname) {
  if (pathname === "/") return "Dashboard";
  if (pathname === "/monitors") return "Monitors";
  if (pathname.startsWith("/monitors/")) return "Monitor";
  if (pathname === "/incidents") return "Incidents";
  if (pathname.startsWith("/incidents/")) return "Incident";
  return "WebMon";
}

function TopBar() {
  const { pathname } = useLocation();
  const { toggleSidebar, sidebarCollapsed, themePreference, cycleTheme } =
    useUI();
  const queryClient = useQueryClient();

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries();
  }, [queryClient]);

  const { icon: ThemeIcon, label: themeLabel } = THEME_META[themePreference];

  return (
    <header
      id="topbar"
      className={`app-topbar fixed top-0 right-0 left-0 z-30 flex items-center justify-between gap-3 px-4 md:px-6 ${
        sidebarCollapsed ? "app-topbar--collapsed" : "app-topbar--expanded"
      }`}
      style={{
        height: "var(--topbar-height)",
        background: "var(--surface)",
        borderBottom: "1px solid var(--border)",
        transition: "left var(--transition-slow)",
      }}
    >
      {/* Left — mobile hamburger + breadcrumbs / mobile title */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="block md:hidden shrink-0">
          <IconButton
            id="topbar-menu-btn"
            onClick={toggleSidebar}
            size="small"
            sx={{ color: "var(--text-primary)" }}
            aria-label="Open sidebar"
          >
            <MenuIcon />
          </IconButton>
        </div>

        <h1
          className="sm:hidden text-base font-semibold truncate"
          style={{ color: "var(--text-primary)" }}
        >
          {getMobileTitle(pathname)}
        </h1>

        <Breadcrumbs />
      </div>

      {/* Right — search + actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        <GlobalSearch />

        <Tooltip title="Refresh data" arrow>
          <IconButton
            id="topbar-refresh-btn"
            onClick={handleRefresh}
            size="small"
            sx={{ color: "var(--text-secondary)" }}
            aria-label="Refresh data"
          >
            <RefreshIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Tooltip>

        <Tooltip title={themeLabel} arrow>
          <IconButton
            id="topbar-theme-btn"
            onClick={cycleTheme}
            size="small"
            sx={{ color: "var(--text-secondary)" }}
            aria-label={themeLabel}
          >
            <ThemeIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Tooltip>

        <NotificationDropdown />

        <div
          className="hidden sm:block w-px h-6 mx-1"
          style={{ background: "var(--border)" }}
        />

        <UserDropdown />
      </div>
    </header>
  );
}

export default memo(TopBar);
