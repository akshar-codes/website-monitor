import { useCallback, useState } from "react";

const STORAGE_KEY = "sitewatch-sidebar-collapsed";

export function useSidebarLayout() {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggle = useCallback(() => {
    if (window.matchMedia("(max-width: 680px)").matches) {
      setMobileOpen((open) => !open);
      return;
    }
    setCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // Sidebar state remains usable when browser storage is unavailable.
      }
      return next;
    });
  }, []);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  return { collapsed, mobileOpen, toggle, closeMobile };
}
