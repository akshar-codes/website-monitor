import UserPreference from "../models/UserPreference.js";

const resolveUserId = (user) => user.id || user._id.toString();

// ── Read ─────────────────────────────────────────────────────────────────────

/**
 * Returns the caller's preferences, lazily creating a default document if
 * this is their first time fetching it. See
 * UserPreference.getOrCreateForUser for the race-safety rationale.
 */
export const getPreferences = async (user) => {
  return UserPreference.getOrCreateForUser(resolveUserId(user));
};

// ── Update: general preferences ─────────────────────────────────────────────

export const updatePreferences = async (user, data) => {
  const prefs = await UserPreference.getOrCreateForUser(resolveUserId(user));

  Object.assign(prefs, data);
  await prefs.save();

  return prefs;
};

// ── Update: dashboard customization ─────────────────────────────────────────

/**
 * Merges a partial dashboard-preferences payload onto the existing
 * subdocument rather than replacing it wholesale — `widgets` in
 * particular is merged key-by-key so toggling one widget never silently
 * resets the others to their schema defaults.
 */
export const updateDashboardPreferences = async (user, data) => {
  const prefs = await UserPreference.getOrCreateForUser(resolveUserId(user));

  if (data.widgets) {
    const currentWidgets = prefs.dashboard.widgets.toObject();
    prefs.dashboard.widgets = { ...currentWidgets, ...data.widgets };
  }

  if (data.widgetOrder !== undefined) {
    prefs.dashboard.widgetOrder = data.widgetOrder;
  }

  if (data.defaultWindow !== undefined) {
    prefs.dashboard.defaultWindow = data.defaultWindow;
  }

  if (data.autoRefreshInterval !== undefined) {
    prefs.dashboard.autoRefreshInterval = data.autoRefreshInterval;
  }

  if (data.compactMode !== undefined) {
    prefs.dashboard.compactMode = data.compactMode;
  }

  // Mongoose doesn't always detect in-place mutation of a nested
  // subdocument's plain-object reassignment (e.g. `widgets` above) —
  // mark it explicitly so `save()` persists the change.
  prefs.markModified("dashboard");
  await prefs.save();

  return prefs;
};

// ── Reset ────────────────────────────────────────────────────────────────────

/**
 * Deletes the caller's preference document and recreates it with schema
 * defaults — simpler and less error-prone than manually resetting every
 * field to match config/preferenceConstants.js, and guarantees the reset
 * document is always in sync with whatever the schema currently defines.
 */
export const resetPreferences = async (user) => {
  const userId = resolveUserId(user);
  await UserPreference.deleteOne({ user: userId });
  return UserPreference.getOrCreateForUser(userId);
};
