import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "../hooks/useAuth";
import * as preferencesApi from "../services/api/preferences";
import { THEMES } from "../constants/preferences";

export const PreferencesContext = createContext(null);

/**
 * Fetched ONCE at the app root — mirrors PermissionsContext's pattern —
 * so every consumer of usePreferences() (the Preferences page, and any
 * future component that reads e.g. dateFormat/timezone for display
 * formatting) shares one cached copy instead of each issuing its own
 * request. Must be nested inside <AuthProvider>, since it only fetches
 * once a user session exists.
 *
 * NOTE ON THEME: this app's design system (see src/index.css) is
 * currently dark-only — the `@theme` tokens have no light-mode
 * counterpart yet. Applying `data-theme` on <html> here is the
 * integration point a future light/system stylesheet would hook into;
 * on its own it does not yet change visual appearance. The preference is
 * still fully persisted and round-tripped so that work is a CSS-only
 * addition later, not a data-model change.
 */
export function PreferencesProvider({ children }) {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState(null);
  const [loading, setLoading] = useState(!!user);

  const applyPreferences = useCallback((prefs) => {
    const theme = prefs?.theme;
    const resolved =
      theme === THEMES.SYSTEM
        ? window.matchMedia?.("(prefers-color-scheme: light)").matches
          ? THEMES.LIGHT
          : THEMES.DARK
        : theme || THEMES.DARK;

    document.documentElement.dataset.theme = resolved;
    document.documentElement.dataset.timezone = prefs?.timezone || "UTC";
    document.documentElement.dataset.dateFormat =
      prefs?.dateFormat || "MMM D, YYYY";
    document.documentElement.dataset.timeFormat = prefs?.timeFormat || "12h";
    document.documentElement.lang = prefs?.language || "en";
    document.documentElement.dataset.compactMode = prefs?.dashboard?.compactMode
      ? "true"
      : "false";
  }, []);

  const loadPreferences = useCallback(async () => {
    if (!user) {
      setPreferences(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data } = await preferencesApi.getPreferences();
      setPreferences(data);
      applyPreferences(data);
    } catch {
      setPreferences(null);
    } finally {
      setLoading(false);
    }
  }, [user, applyPreferences]);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  useEffect(() => {
    if (preferences?.theme !== THEMES.SYSTEM || !window.matchMedia) return;
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const updateSystemTheme = () => applyPreferences(preferences);
    media.addEventListener?.("change", updateSystemTheme);
    return () => media.removeEventListener?.("change", updateSystemTheme);
  }, [preferences, applyPreferences]);

  /**
   * Optimistically merges a server response (or partial patch) into the
   * cached preferences without a network round-trip — used after a
   * successful save so the UI reflects the change instantly.
   */
  const updateLocal = useCallback(
    (patch) => {
      setPreferences((prev) => {
        const next = { ...prev, ...patch };
        applyPreferences(next);
        return next;
      });
    },
    [applyPreferences],
  );

  const value = useMemo(
    () => ({
      preferences,
      loading,
      refetchPreferences: loadPreferences,
      updateLocal,
    }),
    [preferences, loading, loadPreferences, updateLocal],
  );

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}
