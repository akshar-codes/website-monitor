import { memo, useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import DnsRoundedIcon from "@mui/icons-material/DnsRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import KeyboardReturnRoundedIcon from "@mui/icons-material/KeyboardReturnRounded";
import { useUI } from "../../providers/UIProvider";
import { fetchMonitors } from "../../api/monitors";
import { fetchIncidents } from "../../api/incidents";
import { NAV_ITEMS } from "../../utils/navigation";

// Namespaced query keys — deliberately separate from QUERY_KEYS.MONITORS /
// QUERY_KEYS.INCIDENTS so palette lookups never trigger cross-invalidation
// with the monitors/incidents list pages.
const PALETTE_MONITORS_KEY = ["command-palette", "monitors"];
const PALETTE_INCIDENTS_KEY = ["command-palette", "incidents"];

/**
 * Global command palette. Mounted once in Layout so the Ctrl+K / Cmd+K
 * hotkey works from every page. Renders nothing when closed, but stays
 * mounted so the keydown listener is always registered.
 */
function CommandPalette() {
  const { commandPaletteOpen, openCommandPalette, closeCommandPalette } =
    useUI();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);

  // Global hotkey — registered for the lifetime of the app.
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      const isModK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      if (!isModK) return;
      e.preventDefault();
      if (commandPaletteOpen) {
        closeCommandPalette();
      } else {
        openCommandPalette();
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [commandPaletteOpen, openCommandPalette, closeCommandPalette]);

  // Reset transient state on open and focus the input.
  useEffect(() => {
    if (!commandPaletteOpen) return;
    setQuery("");
    setActiveIndex(0);
    const focusTimer = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(focusTimer);
  }, [commandPaletteOpen]);

  // Data is only fetched once the palette is actually open.
  const monitorsQuery = useQuery({
    queryKey: PALETTE_MONITORS_KEY,
    queryFn: () => fetchMonitors({ limit: 50, sortBy: "name", order: "asc" }),
    enabled: commandPaletteOpen,
    staleTime: 60 * 1000,
  });

  const incidentsQuery = useQuery({
    queryKey: PALETTE_INCIDENTS_KEY,
    queryFn: () => fetchIncidents({ limit: 50, status: "active" }),
    enabled: commandPaletteOpen,
    staleTime: 60 * 1000,
  });

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();

    const navResults = NAV_ITEMS.filter((item) =>
      q ? item.label.toLowerCase().includes(q) : true,
    ).map((item) => ({
      id: `nav-${item.path}`,
      label: item.label,
      description: "Go to page",
      icon: item.icon,
      onSelect: () => navigate(item.path),
    }));

    const monitors = monitorsQuery.data?.data || [];
    const monitorMatches = q
      ? monitors.filter(
          (m) =>
            m.name.toLowerCase().includes(q) || m.url.toLowerCase().includes(q),
        )
      : monitors.slice(0, 5);
    const monitorResults = monitorMatches.map((m) => ({
      id: `monitor-${m._id || m.id}`,
      label: m.name,
      description: m.url,
      icon: DnsRoundedIcon,
      badge: m.active ? null : "Paused",
      onSelect: () => navigate(`/monitors/${m._id || m.id}`),
    }));

    const incidents = incidentsQuery.data?.data || [];
    const incidentMatches = q
      ? incidents.filter((i) => i.monitor?.name?.toLowerCase().includes(q))
      : incidents.slice(0, 5);
    const incidentResults = incidentMatches.map((i) => ({
      id: `incident-${i._id || i.id}`,
      label: i.monitor?.name || "Unknown monitor",
      description: `${i.severity} · ${i.status}`,
      icon: WarningAmberRoundedIcon,
      onSelect: () => navigate(`/incidents/${i._id || i.id}`),
    }));

    return [
      { title: "Navigation", items: navResults },
      { title: "Monitors", items: monitorResults },
      { title: "Active Incidents", items: incidentResults },
    ].filter((section) => section.items.length > 0);
  }, [query, monitorsQuery.data, incidentsQuery.data, navigate]);

  const flatItems = useMemo(
    () => sections.flatMap((section) => section.items),
    [sections],
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const handleSelect = useCallback(
    (item) => {
      item.onSelect();
      closeCommandPalette();
    },
    [closeCommandPalette],
  );

  const handleInputKeyDown = useCallback(
    (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((prev) => Math.min(prev + 1, flatItems.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = flatItems[activeIndex];
        if (item) handleSelect(item);
      } else if (e.key === "Escape") {
        closeCommandPalette();
      }
    },
    [flatItems, activeIndex, handleSelect, closeCommandPalette],
  );

  if (!commandPaletteOpen) return null;

  let runningIndex = -1;

  return (
    <div
      id="command-palette-overlay"
      className="fixed inset-0 z-[var(--z-modal)] flex items-start justify-center px-4"
      style={{
        paddingTop: "12vh",
        background: "var(--surface-overlay)",
        backdropFilter: "blur(4px)",
      }}
      onClick={closeCommandPalette}
      role="presentation"
    >
      <div
        id="command-palette"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="w-full animate-scale-in"
        style={{
          maxWidth: 560,
          background: "var(--surface-raised)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-xl)",
          boxShadow: "var(--shadow-xl)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div
          className="flex items-center gap-3 px-4"
          style={{ height: 52, borderBottom: "1px solid var(--border)" }}
        >
          <SearchRoundedIcon
            sx={{ fontSize: 20, color: "var(--text-tertiary)" }}
          />
          <input
            ref={inputRef}
            id="command-palette-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Search monitors, incidents, or pages…"
            autoComplete="off"
            spellCheck={false}
            className="flex-1 bg-transparent outline-none text-sm"
            style={{
              color: "var(--text-primary)",
              fontFamily: "var(--font-sans)",
            }}
          />
          <kbd
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              color: "var(--text-tertiary)",
            }}
          >
            esc
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[360px] overflow-y-auto py-2">
          {flatItems.length === 0 ? (
            <div
              className="py-10 text-center text-sm"
              style={{ color: "var(--text-tertiary)" }}
            >
              {query ? `No results for "${query}"` : "Start typing to search"}
            </div>
          ) : (
            sections.map((section) => (
              <div key={section.title} className="mb-1 last:mb-0">
                <div
                  className="px-4 pt-2 pb-1 text-xs font-semibold uppercase tracking-wide"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {section.title}
                </div>
                {section.items.map((item) => {
                  runningIndex += 1;
                  const isActive = runningIndex === activeIndex;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      id={`command-item-${item.id}`}
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setActiveIndex(runningIndex)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left"
                      style={{
                        background: isActive
                          ? "var(--primary-light)"
                          : "transparent",
                        transition: "background-color var(--transition-fast)",
                      }}
                    >
                      <Icon
                        sx={{
                          fontSize: 18,
                          color: isActive
                            ? "var(--primary)"
                            : "var(--text-tertiary)",
                          flexShrink: 0,
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <div
                          className="text-sm font-medium truncate"
                          style={{
                            color: isActive
                              ? "var(--primary)"
                              : "var(--text-primary)",
                          }}
                        >
                          {item.label}
                        </div>
                        {item.description && (
                          <div
                            className="text-xs truncate"
                            style={{ color: "var(--text-tertiary)" }}
                          >
                            {item.description}
                          </div>
                        )}
                      </div>
                      {item.badge && (
                        <span
                          className="text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0"
                          style={{
                            background: "var(--status-unknown-bg)",
                            color: "var(--status-unknown)",
                          }}
                        >
                          {item.badge}
                        </span>
                      )}
                      {isActive && (
                        <KeyboardReturnRoundedIcon
                          sx={{
                            fontSize: 14,
                            color: "var(--primary)",
                            flexShrink: 0,
                          }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(CommandPalette);
