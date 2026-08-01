/**
 * Client-side mirror of backend/src/config/activityConstants.js, with UI
 * labels attached. Kept in sync manually — same pattern already used for
 * ROLES/PLANS/OAUTH_PROVIDERS/preferences in this codebase, since these
 * are small, rarely-changing enums.
 */

export const ACTIVITY_CATEGORIES = Object.freeze({
  AUTH: "auth",
  MONITOR: "monitor",
  INCIDENT: "incident",
  PROFILE: "profile",
  PLAN: "plan",
  ADMIN: "admin",
  PREFERENCES: "preferences",
  SESSION: "session",
});

export const ACTIVITY_CATEGORY_OPTIONS = [
  { value: ACTIVITY_CATEGORIES.AUTH, label: "Authentication" },
  { value: ACTIVITY_CATEGORIES.MONITOR, label: "Monitors" },
  { value: ACTIVITY_CATEGORIES.INCIDENT, label: "Incidents" },
  { value: ACTIVITY_CATEGORIES.PROFILE, label: "Profile" },
  { value: ACTIVITY_CATEGORIES.PLAN, label: "Plan & billing" },
  { value: ACTIVITY_CATEGORIES.ADMIN, label: "Admin" },
  { value: ACTIVITY_CATEGORIES.PREFERENCES, label: "Preferences" },
  { value: ACTIVITY_CATEGORIES.SESSION, label: "Sessions" },
];

export const ACTIVITY_CATEGORY_LABELS = Object.fromEntries(
  ACTIVITY_CATEGORY_OPTIONS.map((opt) => [opt.value, opt.label]),
);

export const ACTIVITY_WINDOW_OPTIONS = [
  { value: "all", label: "All time" },
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
];
