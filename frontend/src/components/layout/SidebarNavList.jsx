import { memo, useMemo } from "react";
import { useLocation, Link } from "react-router-dom";
import Tooltip from "@mui/material/Tooltip";
import { NAV_ITEMS, getActiveNavIndex } from "../../utils/navigation";

const ITEM_HEIGHT = 44;
const ITEM_GAP = 6;

function SidebarNavList({ collapsed = false, onItemClick }) {
  const { pathname } = useLocation();
  const activeIndex = useMemo(() => getActiveNavIndex(pathname), [pathname]);

  return (
    <nav className="flex-1 px-3 py-4 overflow-y-auto overflow-x-hidden">
      <div
        className="relative"
        style={{ display: "flex", flexDirection: "column", gap: ITEM_GAP }}
      >
        {/* Sliding active-route indicator */}
        {activeIndex >= 0 && (
          <div
            aria-hidden="true"
            className="absolute left-0 right-0 rounded-lg pointer-events-none"
            style={{
              height: ITEM_HEIGHT,
              background: "var(--primary)",
              transform: `translateY(${activeIndex * (ITEM_HEIGHT + ITEM_GAP)}px)`,
              transition: "transform var(--transition-base)",
              boxShadow: "var(--shadow-sm)",
            }}
          />
        )}

        {NAV_ITEMS.map((item, index) => {
          const active = index === activeIndex;
          const Icon = item.icon;

          const link = (
            <Link
              id={`nav-link-${item.label.toLowerCase()}`}
              to={item.path}
              onClick={onItemClick}
              className="relative z-10 flex items-center gap-3 rounded-lg text-sm font-medium"
              style={{
                height: ITEM_HEIGHT,
                paddingInline: collapsed ? 0 : 12,
                justifyContent: collapsed ? "center" : "flex-start",
                color: active ? "#ffffff" : "var(--neutral-400)",
                transition: "color var(--transition-fast)",
              }}
              onMouseEnter={(e) => {
                if (!active) e.currentTarget.style.color = "#ffffff";
              }}
              onMouseLeave={(e) => {
                if (!active) e.currentTarget.style.color = "var(--neutral-400)";
              }}
            >
              <Icon sx={{ fontSize: 20, flexShrink: 0 }} />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );

          return (
            <div key={item.path}>
              {collapsed ? (
                <Tooltip title={item.label} placement="right" arrow>
                  {link}
                </Tooltip>
              ) : (
                link
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}

export default memo(SidebarNavList);
