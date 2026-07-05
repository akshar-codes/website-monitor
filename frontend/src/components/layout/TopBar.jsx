import { memo, useMemo, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import MenuIcon from '@mui/icons-material/Menu';
import RefreshIcon from '@mui/icons-material/Refresh';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import ComputerIcon from '@mui/icons-material/Computer';
import { useUI } from '../../providers/UIProvider';

const THEME_META = {
  system: { icon: ComputerIcon, label: 'Theme: System' },
  light: { icon: LightModeIcon, label: 'Theme: Light' },
  dark: { icon: DarkModeIcon, label: 'Theme: Dark' },
};

function getPageTitle(pathname) {
  if (pathname === '/') return 'Dashboard';

  if (pathname === '/monitors') return 'Monitors';
  if (pathname.startsWith('/monitors/')) return 'Monitor Details';

  if (pathname === '/incidents') return 'Incidents';
  if (pathname.startsWith('/incidents/')) return 'Incident Details';

  return 'Dashboard';
}

function TopBar() {
  const { pathname } = useLocation();
  const { toggleSidebar, themePreference, cycleTheme } = useUI();
  const queryClient = useQueryClient();

  const pageTitle = useMemo(() => getPageTitle(pathname), [pathname]);

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries();
  }, [queryClient]);

  const { icon: ThemeIcon, label: themeLabel } = THEME_META[themePreference];

  return (
    <header
      id="topbar"
      className="fixed top-0 right-0 left-0 md:left-[260px] z-30 flex items-center justify-between px-4 md:px-6"
      style={{
        height: 'var(--topbar-height)',
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {/* Left — mobile hamburger + page title */}
      <div className="flex items-center gap-2">
        {/* Mobile-only sidebar hamburger */}
        <div className="block md:hidden">
          <IconButton
            id="topbar-menu-btn"
            onClick={toggleSidebar}
            size="small"
            sx={{ color: 'var(--text-primary)' }}
            aria-label="Open sidebar"
          >
            <MenuIcon />
          </IconButton>
        </div>

        <h1
          className="text-lg font-semibold truncate"
          style={{ color: 'var(--text-primary)' }}
        >
          {pageTitle}
        </h1>
      </div>

      {/* Right — actions */}
      <div className="flex items-center gap-1">
        <Tooltip title="Refresh data" arrow>
          <IconButton
            id="topbar-refresh-btn"
            onClick={handleRefresh}
            size="small"
            sx={{ color: 'var(--text-secondary)' }}
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
            sx={{ color: 'var(--text-secondary)' }}
            aria-label={themeLabel}
          >
            <ThemeIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Tooltip>
      </div>
    </header>
  );
}

export default memo(TopBar);
