import { memo, useCallback } from "react";
import { Link } from "react-router-dom";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import MonitorHeartIcon from "@mui/icons-material/MonitorHeart";
import { useUI } from "../../providers/UIProvider";
import SidebarNavList from "./SidebarNavList";
import ServerHealthIndicator from "./ServerHealthIndicator";

const DRAWER_WIDTH = 280;

function MobileMenu() {
  const { sidebarOpen, closeSidebar } = useUI();

  const handleItemClick = useCallback(() => {
    closeSidebar();
  }, [closeSidebar]);

  return (
    <Drawer
      open={sidebarOpen}
      onClose={closeSidebar}
      variant="temporary"
      ModalProps={{ keepMounted: true }}
      PaperProps={{
        sx: {
          border: "none !important",
          bgcolor: "var(--neutral-900) !important",
          width: DRAWER_WIDTH,
        },
      }}
    >
      <div
        className="flex flex-col h-full"
        style={{ width: DRAWER_WIDTH, background: "var(--neutral-900)" }}
      >
        {/* Brand */}
        <div className="flex items-center justify-between gap-3 px-5 h-16 shrink-0 border-b border-white/10">
          <Link
            to="/"
            onClick={handleItemClick}
            className="flex items-center gap-3 min-w-0"
          >
            <MonitorHeartIcon
              sx={{ color: "var(--primary)", fontSize: 28, flexShrink: 0 }}
            />
            <span className="text-lg font-bold tracking-tight text-white truncate">
              WebMon
            </span>
          </Link>
          <IconButton
            id="mobile-menu-close"
            onClick={closeSidebar}
            size="small"
            sx={{ color: "var(--neutral-400)", flexShrink: 0 }}
            aria-label="Close menu"
          >
            <CloseRoundedIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </div>

        {/* Navigation */}
        <SidebarNavList collapsed={false} onItemClick={handleItemClick} />

        {/* Footer — Server Health */}
        <div className="shrink-0 border-t border-white/10">
          <ServerHealthIndicator />
        </div>
      </div>
    </Drawer>
  );
}

export default memo(MobileMenu);
