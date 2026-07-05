import { memo, useState, useCallback } from "react";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Divider from "@mui/material/Divider";
import ListItemIcon from "@mui/material/ListItemIcon";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";
import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import ComputerRoundedIcon from "@mui/icons-material/ComputerRounded";
import toast from "react-hot-toast";
import { useAuth } from "../../providers/AuthProvider";
import { useUI } from "../../providers/UIProvider";

const THEME_META = {
  system: { icon: ComputerRoundedIcon, label: "System" },
  light: { icon: LightModeRoundedIcon, label: "Light" },
  dark: { icon: DarkModeRoundedIcon, label: "Dark" },
};

function getInitials(name) {
  if (!name) return "U";
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * Account menu. AuthProvider is currently a V0 stub (always authenticated,
 * user: null) — this renders sensible fallback identity text and wires
 * every action to a real handler (theme cycling, logout) rather than
 * fabricating unimplemented links like "Profile" or "Settings".
 */
function UserDropdown() {
  const [anchorEl, setAnchorEl] = useState(null);
  const { user, logout } = useAuth();
  const { themePreference, cycleTheme } = useUI();
  const open = Boolean(anchorEl);

  const displayName = user?.name || "Admin User";
  const displayEmail = user?.email || "admin@webmon.local";

  const handleOpen = useCallback((e) => setAnchorEl(e.currentTarget), []);
  const handleClose = useCallback(() => setAnchorEl(null), []);

  const handleLogout = useCallback(() => {
    logout();
    handleClose();
    toast.success("Signed out");
  }, [logout, handleClose]);

  const ThemeIcon = THEME_META[themePreference].icon;

  return (
    <>
      <IconButton
        id="user-menu-trigger"
        onClick={handleOpen}
        size="small"
        sx={{ p: 0.25 }}
        aria-label="Account menu"
      >
        <div
          className="flex items-center justify-center rounded-full text-xs font-bold"
          style={{
            width: 32,
            height: 32,
            background: "var(--primary)",
            color: "#ffffff",
          }}
        >
          {getInitials(displayName)}
        </div>
      </IconButton>

      <Menu
        id="user-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: {
            sx: {
              width: 260,
              bgcolor: "var(--surface-raised)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-lg)",
              boxShadow: "var(--shadow-lg)",
              mt: 1,
            },
          },
        }}
      >
        <div
          className="px-4 py-3"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <p
            className="text-sm font-semibold truncate"
            style={{ color: "var(--text-primary)" }}
          >
            {displayName}
          </p>
          <p
            className="text-xs truncate"
            style={{ color: "var(--text-tertiary)" }}
          >
            {displayEmail}
          </p>
        </div>

        <MenuItem
          onClick={cycleTheme}
          sx={{
            fontFamily: "var(--font-sans)",
            fontSize: "0.85rem",
            color: "var(--text-primary)",
          }}
        >
          <ListItemIcon>
            <ThemeIcon sx={{ fontSize: 18, color: "var(--text-secondary)" }} />
          </ListItemIcon>
          Theme: {THEME_META[themePreference].label}
        </MenuItem>

        <Divider sx={{ borderColor: "var(--border)" }} />

        <MenuItem
          onClick={handleLogout}
          sx={{
            fontFamily: "var(--font-sans)",
            fontSize: "0.85rem",
            color: "var(--status-down)",
          }}
        >
          <ListItemIcon>
            <LogoutRoundedIcon
              sx={{ fontSize: 18, color: "var(--status-down)" }}
            />
          </ListItemIcon>
          Sign out
        </MenuItem>
      </Menu>
    </>
  );
}

export default memo(UserDropdown);
