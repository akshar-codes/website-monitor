/**
 * Client-side mirror of backend/src/config/preferenceConstants.js, with
 * UI labels attached for each option. Kept in sync manually — same
 * pattern already used for ROLES/PLANS/OAUTH_PROVIDERS in this codebase,
 * since these are small, rarely-changing enums.
 */

export const THEMES = Object.freeze({
  LIGHT: "light",
  DARK: "dark",
  SYSTEM: "system",
});

export const THEME_OPTIONS = [
  { value: THEMES.DARK, label: "Dark" },
  { value: THEMES.LIGHT, label: "Light" },
  { value: THEMES.SYSTEM, label: "System" },
];

export const LANGUAGES = Object.freeze({
  EN: "en",
  ES: "es",
  FR: "fr",
  DE: "de",
  PT: "pt",
  HI: "hi",
  JA: "ja",
  ZH: "zh",
});

export const LANGUAGE_OPTIONS = [
  { value: LANGUAGES.EN, label: "English" },
  { value: LANGUAGES.ES, label: "Español" },
  { value: LANGUAGES.FR, label: "Français" },
  { value: LANGUAGES.DE, label: "Deutsch" },
  { value: LANGUAGES.PT, label: "Português" },
  { value: LANGUAGES.HI, label: "हिन्दी" },
  { value: LANGUAGES.JA, label: "日本語" },
  { value: LANGUAGES.ZH, label: "中文" },
];

export const DATE_FORMATS = Object.freeze({
  MDY_SLASH: "MM/DD/YYYY",
  DMY_SLASH: "DD/MM/YYYY",
  ISO: "YYYY-MM-DD",
  MONTH_D_YYYY: "MMM D, YYYY",
});

export const DATE_FORMAT_OPTIONS = [
  { value: DATE_FORMATS.MONTH_D_YYYY, label: "Jan 5, 2026" },
  { value: DATE_FORMATS.MDY_SLASH, label: "01/05/2026" },
  { value: DATE_FORMATS.DMY_SLASH, label: "05/01/2026" },
  { value: DATE_FORMATS.ISO, label: "2026-01-05" },
];

export const TIME_FORMATS = Object.freeze({
  H12: "12h",
  H24: "24h",
});

export const TIME_FORMAT_OPTIONS = [
  { value: TIME_FORMATS.H12, label: "12-hour (3:45 PM)" },
  { value: TIME_FORMATS.H24, label: "24-hour (15:45)" },
];

export const DASHBOARD_REFRESH_OPTIONS = [
  { value: 10, label: "10 seconds" },
  { value: 30, label: "30 seconds" },
  { value: 60, label: "1 minute" },
  { value: 300, label: "5 minutes" },
];

export const DEFAULT_WINDOW_OPTIONS = [
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
];

/** Order here also defines the default widget order. */
export const WIDGET_KEYS = Object.freeze([
  "quickActions",
  "overviewChart",
  "recentActivity",
  "activeIncidents",
  "monitorStatusGrid",
]);

export const WIDGET_LABELS = Object.freeze({
  quickActions: "Quick Actions",
  overviewChart: "Response Time & Uptime Chart",
  recentActivity: "Recent Activity",
  activeIncidents: "Active Incidents",
  monitorStatusGrid: "Monitor Status Grid",
});

/**
 * A representative subset of IANA timezones for the picker — the backend
 * accepts (and validates via Intl) any valid IANA identifier, not just
 * these, so a value outside this list loaded from the server still
 * displays correctly even though it isn't one of the presets.
 */
export const COMMON_TIMEZONES = Object.freeze([
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Moscow",
  "Africa/Cairo",
  "Africa/Johannesburg",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Singapore",
  "Australia/Sydney",
  "Pacific/Auckland",
]);
