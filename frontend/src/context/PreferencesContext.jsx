import { useCallback, useEffect, useMemo, useState } from "react";
import { PreferencesContext } from "../contexts/PreferencesContext";
import { useAuth } from "../hooks/useAuth";
import * as preferencesApi from "../services/api/preferences";
import { LanguageContext } from "../i18n";

/**
 * Fetched ONCE at the app root — mirrors PermissionsContext's pattern —
 * so every consumer of usePreferences() (the Preferences page, and any
 * future component that reads e.g. dateFormat/timezone for display
 * formatting) shares one cached copy instead of each issuing its own
 * request. Must be nested inside <AuthProvider>, since it only fetches
 * once a user session exists.
 *
 * SiteWatch is presented in light mode throughout the product. Older saved
 * dark/system values are intentionally ignored so they cannot change the UI.
 */
export function PreferencesProvider({ children }) {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState(null);
  const [loading, setLoading] = useState(!!user);

  const applyPreferences = useCallback((prefs) => {
    document.documentElement.dataset.theme = "light";
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
    const request = setTimeout(loadPreferences, 0);
    return () => clearTimeout(request);
  }, [loadPreferences]);

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
      <LanguageContext.Provider value={preferences?.language || "en"}>
        {children}
      </LanguageContext.Provider>
    </PreferencesContext.Provider>
  );
}
