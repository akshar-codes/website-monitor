import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";

const UIContext = createContext(null);

function getInitialTheme() {
  const stored = localStorage.getItem("theme");
  if (stored && ["system", "light", "dark"].includes(stored)) return stored;
  return "system";
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [themePreference, setThemePreference] = useState(getInitialTheme);
  const [resolvedTheme, setResolvedTheme] = useState(() =>
    resolveTheme(getInitialTheme()),
  );

  // Apply theme to document
  useEffect(() => {
    const resolved = resolveTheme(themePreference);
    setResolvedTheme(resolved);
    document.documentElement.setAttribute("data-theme", resolved);
    localStorage.setItem("theme", themePreference);
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

  const toggleSidebar = useCallback(() => setSidebarOpen((v) => !v), []);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  const cycleTheme = useCallback(() => {
    setThemePreference((prev) => {
      const order = ["system", "light", "dark"];
      const next = order[(order.indexOf(prev) + 1) % order.length];
      return next;
    });
  }, []);

  const value = {
    sidebarOpen,
    toggleSidebar,
    closeSidebar,
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
