// ── Theme ────────────────────────────────────────────────────────────────────

export const THEMES = Object.freeze({
  LIGHT: "light",
  DARK: "dark",
  SYSTEM: "system",
});

export const THEME_VALUES = Object.freeze(Object.values(THEMES));

// ── Language ─────────────────────────────────────────────────────────────────

/**
 * Supported interface locale codes. Keep these in sync with the frontend
 * preference options; ja-Latn selects Japanese copy rendered in Romaji.
 */
export const LANGUAGES = Object.freeze({
  EN: "en",
  ES: "es",
  FR: "fr",
  DE: "de",
  PT: "pt",
  HI: "hi",
  JA: "ja",
  JA_LATN: "ja-Latn",
  ZH: "zh",
});

export const LANGUAGE_VALUES = Object.freeze(Object.values(LANGUAGES));

// ── Date / time formatting ──────────────────────────────────────────────────

export const DATE_FORMATS = Object.freeze({
  MDY_SLASH: "MM/DD/YYYY",
  DMY_SLASH: "DD/MM/YYYY",
  ISO: "YYYY-MM-DD",
  MONTH_D_YYYY: "MMM D, YYYY",
});

export const DATE_FORMAT_VALUES = Object.freeze(Object.values(DATE_FORMATS));

export const TIME_FORMATS = Object.freeze({
  H12: "12h",
  H24: "24h",
});

export const TIME_FORMAT_VALUES = Object.freeze(Object.values(TIME_FORMATS));

// ── Dashboard customization ─────────────────────────────────────────────────

/** Allowed auto-refresh intervals, in seconds. */
export const DASHBOARD_REFRESH_INTERVALS = Object.freeze([10, 30, 60, 300]);

/** Dashboard widgets that can be toggled and reordered. */
export const WIDGET_KEYS = Object.freeze([
  "quickActions",
  "overviewChart",
  "recentActivity",
  "activeIncidents",
  "monitorStatusGrid",
]);

export const DEFAULT_WIDGET_ORDER = Object.freeze([...WIDGET_KEYS]);
