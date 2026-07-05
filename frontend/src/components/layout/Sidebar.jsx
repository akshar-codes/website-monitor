import { memo } from "react";
import { Link } from "react-router-dom";
import useMediaQuery from "@mui/material/useMediaQuery";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import MonitorHeartIcon from "@mui/icons-material/MonitorHeart";
import { useUI } from "../../providers/UIProvider";
import SidebarNavList from "./SidebarNavList";
import ServerHealthIndicator from "./ServerHealthIndicator";
import MobileMenu from "./MobileMenu";

/**
 * Application sidebar.
 * - Below `md`: delegates entirely to the MobileMenu drawer.
 * - `md` and above: fixed rail that animates between full width
 *   (--sidebar-width) and icon-only width (--sidebar-collapsed).
 */
function Sidebar() {
  const { sidebarCollapsed, toggleSidebarCollapsed } = useUI();
  const isMobile = useMediaQuery("(max-width: 767px)");

  if (isMobile) {
    return <MobileMenu />;
  }

  return (
    <aside
      id="sidebar"
      className="fixed top-0 left-0 h-screen z-40 hidden md:flex md:flex-col"
      style={{
        width: sidebarCollapsed
          ? "var(--sidebar-collapsed)"
          : "var(--sidebar-width)",
        background: "var(--neutral-900)",
        transition: "width var(--transition-slow)",
        overflow: "hidden",
      }}
    >
      {/* Brand */}
      <div
        className="flex items-center h-16 shrink-0 border-b border-white/10"
        style={{
          paddingInline: sidebarCollapsed ? 0 : 20,
          justifyContent: sidebarCollapsed ? "center" : "flex-start",
        }}
      >
        <Link to="/" className="flex items-center gap-3 min-w-0">
          <MonitorHeartIcon
            sx={{ color: "var(--primary)", fontSize: 28, flexShrink: 0 }}
          />
          {!sidebarCollapsed && (
            <span className="text-lg font-bold tracking-tight text-white truncate">
              WebMon
            </span>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <SidebarNavList collapsed={sidebarCollapsed} />

      {/* Collapse toggle */}
      <div
        className="shrink-0 border-t border-white/10 flex px-2 py-2"
        style={{ justifyContent: sidebarCollapsed ? "center" : "flex-end" }}
      >
        <Tooltip
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          placement="right"
          arrow
        >
          <IconButton
            id="sidebar-collapse-toggle"
            onClick={toggleSidebarCollapsed}
            size="small"
            sx={{
              color: "var(--neutral-400)",
              width: 32,
              height: 32,
              transition:
                "color var(--transition-fast), background-color var(--transition-fast)",
              "&:hover": {
                color: "#ffffff",
                bgcolor: "rgba(255,255,255,0.06)",
              },
            }}
            aria-label={
              sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
            }
          >
            <ChevronLeftRoundedIcon
              sx={{
                fontSize: 20,
                transform: sidebarCollapsed ? "rotate(180deg)" : "none",
                transition: "transform var(--transition-base)",
              }}
            />
          </IconButton>
        </Tooltip>
      </div>

      {/* Footer — Server Health */}
      <div className="shrink-0 border-t border-white/10">
        <ServerHealthIndicator collapsed={sidebarCollapsed} />
      </div>
    </aside>
  );
}

export default memo(Sidebar);
