import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";

const UIContext = createContext(null);

const THEME_KEY = "theme";
const SIDEBAR_COLLAPSED_KEY = "sidebar_collapsed";

function getInitialTheme() {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored && ["system", "light", "dark"].includes(stored)) return stored;
  return "system";
}

function getInitialCollapsed() {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
  } catch {
    return false;
  }
}

function resolveTheme(preference) {
  if (preference === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return preference;
}

export function UIProvider({ children }) {
  // ── Mobile drawer (sidebar) ──
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ── Desktop sidebar collapse (icon-only rail) ──
  const [sidebarCollapsed, setSidebarCollapsed] = useState(getInitialCollapsed);

  // ── Command palette (Ctrl+K / Cmd+K) ──
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // ── Theme ──
  const [themePreference, setThemePreference] = useState(getInitialTheme);
  const [resolvedTheme, setResolvedTheme] = useState(() =>
    resolveTheme(getInitialTheme()),
  );

  // Apply theme to document
  useEffect(() => {
    const resolved = resolveTheme(themePreference);
    setResolvedTheme(resolved);
    document.documentElement.setAttribute("data-theme", resolved);
    localStorage.setItem(THEME_KEY, themePreference);
  }, [themePreference]);

  // Listen for OS theme changes when preference is 'system'
  useEffect(() => {
    if (themePreference !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e) => {
      const resolved = e.matches ? "dark" : "light";
      setResolvedTheme(resolved);
      document.documentElement.setAttribute("data-theme", resolved);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [themePreference]);

  // Persist sidebar collapse preference
  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(sidebarCollapsed));
    } catch {
      // localStorage unavailable (private browsing, storage quota, etc.) — safe to ignore
    }
  }, [sidebarCollapsed]);

  const toggleSidebar = useCallback(() => setSidebarOpen((v) => !v), []);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  const toggleSidebarCollapsed = useCallback(
    () => setSidebarCollapsed((v) => !v),
    [],
  );

  const openCommandPalette = useCallback(() => setCommandPaletteOpen(true), []);
  const closeCommandPalette = useCallback(
    () => setCommandPaletteOpen(false),
    [],
  );
  const toggleCommandPalette = useCallback(
    () => setCommandPaletteOpen((v) => !v),
    [],
  );

  const cycleTheme = useCallback(() => {
    setThemePreference((prev) => {
      const order = ["system", "light", "dark"];
      const next = order[(order.indexOf(prev) + 1) % order.length];
      return next;
    });
  }, []);

  const value = {
    // mobile drawer
    sidebarOpen,
    toggleSidebar,
    closeSidebar,
    // desktop collapse
    sidebarCollapsed,
    toggleSidebarCollapsed,
    // command palette
    commandPaletteOpen,
    openCommandPalette,
    closeCommandPalette,
    toggleCommandPalette,
    // theme
    themePreference,
    resolvedTheme,
    cycleTheme,
  };

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

export function useUI() {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error("useUI must be used within UIProvider");
  return ctx;
}

export default UIContext;
