import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import DnsRoundedIcon from "@mui/icons-material/DnsRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";

export const NAV_ITEMS = [
  { path: "/", label: "Dashboard", icon: DashboardRoundedIcon, exact: true },
  { path: "/monitors", label: "Monitors", icon: DnsRoundedIcon, exact: false },
  {
    path: "/incidents",
    label: "Incidents",
    icon: WarningAmberRoundedIcon,
    exact: false,
  },
];

/**
 * Determine whether a nav item is active for the current pathname.
 */
export function isNavItemActive(pathname, item) {
  if (item.exact) return pathname === item.path;
  return pathname === item.path || pathname.startsWith(`${item.path}/`);
}

/**
 * Return the index of the active nav item for a pathname, or -1 if none match.
 */
export function getActiveNavIndex(pathname) {
  return NAV_ITEMS.findIndex((item) => isNavItemActive(pathname, item));
}

/**
 * Static, human-readable labels for known static path segments.
 * Dynamic segments (Mongo ids) are resolved by the caller — see Breadcrumbs.jsx.
 */
export const SEGMENT_LABELS = {
  monitors: "Monitors",
  incidents: "Incidents",
};
