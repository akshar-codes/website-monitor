import { memo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import Tooltip from "@mui/material/Tooltip";
import NotificationsRoundedIcon from "@mui/icons-material/NotificationsRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import { useIncidents } from "../../hooks/queries/useIncidents";
import SeverityBadge from "../shared/SeverityBadge";
import RelativeTime from "../shared/RelativeTime";

/**
 * Notifications are backed by real active-incident data (no synthetic
 * notification model exists yet) — this reuses the same useIncidents
 * hook and query key as the Incidents page, so both stay in sync.
 */
function NotificationDropdown() {
  const [anchorEl, setAnchorEl] = useState(null);
  const navigate = useNavigate();
  const open = Boolean(anchorEl);

  const { data } = useIncidents({ status: "active", limit: 5, page: 1 });
  const incidents = data?.data || [];
  const total = data?.pagination?.total ?? incidents.length;

  const handleOpen = useCallback((e) => setAnchorEl(e.currentTarget), []);
  const handleClose = useCallback(() => setAnchorEl(null), []);

  const handleSelect = useCallback(
    (incident) => {
      navigate(`/incidents/${incident._id || incident.id}`);
      handleClose();
    },
    [navigate, handleClose],
  );

  const handleViewAll = useCallback(() => {
    navigate("/incidents");
    handleClose();
  }, [navigate, handleClose]);

  return (
    <>
      <Tooltip title="Notifications" arrow>
        <IconButton
          id="notifications-trigger"
          onClick={handleOpen}
          size="small"
          sx={{ color: "var(--text-secondary)", position: "relative" }}
          aria-label="Notifications"
        >
          <NotificationsRoundedIcon sx={{ fontSize: 20 }} />
          {total > 0 && (
            <span
              className="absolute flex items-center justify-center"
              style={{
                top: 4,
                right: 4,
                minWidth: 14,
                height: 14,
                borderRadius: "var(--radius-full)",
                background: "var(--status-down)",
                color: "#fff",
                fontSize: 9,
                fontWeight: 700,
                padding: "0 3px",
              }}
            >
              {total > 9 ? "9+" : total}
            </span>
          )}
        </IconButton>
      </Tooltip>

      <Menu
        id="notifications-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: {
            sx: {
              width: 340,
              maxHeight: 420,
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
          className="px-4 py-3 flex items-center justify-between"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <span
            className="text-sm font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            Notifications
          </span>
          {total > 0 && (
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{
                background: "var(--status-down-bg)",
                color: "var(--status-down)",
              }}
            >
              {total} active
            </span>
          )}
        </div>

        {incidents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
            <CheckCircleRoundedIcon
              sx={{ fontSize: 28, color: "var(--status-up)", mb: 1 }}
            />
            <p
              className="text-sm font-medium"
              style={{ color: "var(--text-primary)" }}
            >
              All clear
            </p>
            <p
              className="text-xs mt-0.5"
              style={{ color: "var(--text-tertiary)" }}
            >
              No active incidents right now
            </p>
          </div>
        ) : (
          <div>
            {incidents.map((incident) => (
              <button
                key={incident._id || incident.id}
                type="button"
                onClick={() => handleSelect(incident)}
                className="w-full text-left px-4 py-3 flex flex-col gap-1"
                style={{
                  borderBottom: "1px solid var(--border)",
                  transition: "background-color var(--transition-fast)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "var(--surface)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                <div className="flex items-center gap-2">
                  <SeverityBadge severity={incident.severity} size="sm" />
                  <span
                    className="text-sm font-medium truncate"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {incident.monitor?.name || "Unknown monitor"}
                  </span>
                </div>
                <RelativeTime date={incident.startedAt} className="text-xs!" />
              </button>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={handleViewAll}
          className="w-full text-center py-2.5 text-xs font-semibold"
          style={{ color: "var(--primary)" }}
        >
          View all incidents
        </button>
      </Menu>
    </>
  );
}

export default memo(NotificationDropdown);
