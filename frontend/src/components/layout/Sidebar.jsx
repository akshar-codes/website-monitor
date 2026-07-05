import { memo, useCallback } from 'react';
import { useLocation, Link } from 'react-router-dom';
import Drawer from '@mui/material/Drawer';
import Tooltip from '@mui/material/Tooltip';
import useMediaQuery from '@mui/material/useMediaQuery';
import DashboardIcon from '@mui/icons-material/Dashboard';
import DnsIcon from '@mui/icons-material/Dns';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import { useUI } from '../../providers/UIProvider';
import { useServerHealth } from '../../hooks/queries/useServerHealth';

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: DashboardIcon },
  { path: '/monitors', label: 'Monitors', icon: DnsIcon },
  { path: '/incidents', label: 'Incidents', icon: WarningAmberIcon },
];

function isActive(pathname, path) {
  if (path === '/') return pathname === '/';
  return pathname.startsWith(path);
}

function HealthIndicator() {
  const { data, isLoading, isError } = useServerHealth();

  const dotColor = isLoading
    ? 'bg-gray-400'
    : isError
      ? 'bg-red-500'
      : 'bg-emerald-500';

  const statusText = isLoading
    ? 'Checking server...'
    : isError
      ? 'Server unreachable'
      : `Server healthy — ${data?.environment ?? 'unknown'} • Uptime: ${Math.floor((data?.uptime ?? 0) / 3600)}h`;

  return (
    <Tooltip title={statusText} placement="top" arrow>
      <div
        id="server-health-indicator"
        className="flex items-center gap-2.5 px-4 py-3 cursor-default select-none"
      >
        <span className="relative flex h-2.5 w-2.5">
          {!isLoading && !isError && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          )}
          <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${dotColor}`} />
        </span>
        <span className="text-xs text-gray-400 truncate">
          {isLoading ? 'Connecting...' : isError ? 'Disconnected' : 'Server Online'}
        </span>
      </div>
    </Tooltip>
  );
}

function SidebarContent({ onLinkClick }) {
  const { pathname } = useLocation();

  return (
    <div
      className="flex flex-col h-full"
      style={{
        width: 'var(--sidebar-width)',
        background: 'var(--gray-900)',
      }}
    >
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 h-16 shrink-0 border-b border-white/10">
        <MonitorHeartIcon
          sx={{ color: 'var(--primary)', fontSize: 28 }}
        />
        <span className="text-lg font-bold tracking-tight text-white">
          WebMon
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-1 px-3 py-4 overflow-y-auto">
        {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
          const active = isActive(pathname, path);
          return (
            <Link
              key={path}
              id={`nav-link-${label.toLowerCase()}`}
              to={path}
              onClick={onLinkClick}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150"
              style={{
                color: active ? '#ffffff' : 'var(--gray-400)',
                background: active ? 'var(--primary)' : 'transparent',
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                  e.currentTarget.style.color = '#ffffff';
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--gray-400)';
                }
              }}
            >
              <Icon sx={{ fontSize: 20 }} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer — Server Health */}
      <div className="shrink-0 border-t border-white/10">
        <HealthIndicator />
      </div>
    </div>
  );
}

function Sidebar() {
  const { sidebarOpen, closeSidebar } = useUI();
  const isMobile = useMediaQuery('(max-width: 767px)');

  const handleLinkClick = useCallback(() => {
    if (isMobile) closeSidebar();
  }, [isMobile, closeSidebar]);

  // Mobile: render as MUI Drawer overlay
  if (isMobile) {
    return (
      <Drawer
        open={sidebarOpen}
        onClose={closeSidebar}
        variant="temporary"
        ModalProps={{ keepMounted: true }}
        PaperProps={{
          sx: {
            border: 'none !important',
            bgcolor: 'var(--gray-900) !important',
          },
        }}
      >
        <SidebarContent onLinkClick={handleLinkClick} />
      </Drawer>
    );
  }

  // Desktop: fixed sidebar
  return (
    <aside
      id="sidebar"
      className="fixed top-0 left-0 h-screen z-40 hidden md:block"
      style={{ width: 'var(--sidebar-width)' }}
    >
      <SidebarContent onLinkClick={handleLinkClick} />
    </aside>
  );
}

export default memo(Sidebar);
