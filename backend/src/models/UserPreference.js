import mongoose from "mongoose";
import {
  THEME_VALUES,
  LANGUAGE_VALUES,
  DATE_FORMAT_VALUES,
  TIME_FORMAT_VALUES,
  DASHBOARD_REFRESH_INTERVALS,
  WIDGET_KEYS,
  DEFAULT_WIDGET_ORDER,
} from "../config/preferenceConstants.js";
import { WINDOW_KEYS } from "../config/constants.js";

// ── Dashboard widget visibility ─────────────────────────────────────────────

const dashboardWidgetsSchema = new mongoose.Schema(
  {
    showQuickActions: { type: Boolean, default: true },
    showOverviewChart: { type: Boolean, default: true },
    showRecentActivity: { type: Boolean, default: true },
    showActiveIncidents: { type: Boolean, default: true },
    showMonitorStatusGrid: { type: Boolean, default: true },
  },
  { _id: false },
);

// ── Dashboard customization ─────────────────────────────────────────────────

const dashboardPreferencesSchema = new mongoose.Schema(
  {
    defaultWindow: {
      type: String,
      enum: {
        values: WINDOW_KEYS,
        message: `Default window must be one of: ${WINDOW_KEYS.join(", ")}`,
      },
      default: "24h",
    },

    autoRefreshInterval: {
      type: Number,
      enum: {
        values: DASHBOARD_REFRESH_INTERVALS,
        message: `Auto-refresh interval must be one of: ${DASHBOARD_REFRESH_INTERVALS.join(", ")} (seconds)`,
      },
      default: 30,
    },

    compactMode: {
      type: Boolean,
      default: false,
    },

    widgets: {
      type: dashboardWidgetsSchema,
      default: () => ({}),
    },

    widgetOrder: {
      type: [String],
      enum: {
        values: WIDGET_KEYS,
        message: `Widget order can only contain: ${WIDGET_KEYS.join(", ")}`,
      },
      default: () => [...DEFAULT_WIDGET_ORDER],
    },
  },
  { _id: false },
);

const notificationPreferencesSchema = new mongoose.Schema(
  {
    inApp: {
      monitorDown: { type: Boolean, default: true },
      monitorRecovery: { type: Boolean, default: true },
      performanceAlerts: { type: Boolean, default: true },
      regionalMonitoring: { type: Boolean, default: true },
      sslExpiry: { type: Boolean, default: true },
      incidents: { type: Boolean, default: true },
      billing: { type: Boolean, default: true },
      accountSecurity: { type: Boolean, default: true },
      systemAnnouncements: { type: Boolean, default: true },
    },
    email: {
      enabled: { type: Boolean, default: false },
      monitorDown: { type: Boolean, default: true },
      monitorRecovery: { type: Boolean, default: true },
      performanceAlerts: { type: Boolean, default: true },
      regionalMonitoring: { type: Boolean, default: true },
      sslExpiry: { type: Boolean, default: true },
      incidents: { type: Boolean, default: true },
      enabledAt: { type: Date, default: null },
    },
    frequency: {
      type: String,
      enum: ["immediate", "daily", "weekly"],
      default: "immediate",
    },
  },
  { _id: false },
);

// ── Top-level preferences ────────────────────────────────────────────────────

const userPreferenceSchema = new mongoose.Schema(
  {
    // One preference document per user — separate collection (rather than
    // embedding on User) so this feature stays independently reusable and
    // the User document doesn't grow unbounded as personalization expands
    // (mirrors how Monitor/Incident are separate, owner-scoped collections
    // rather than arrays embedded on User).
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required"],
    },

    theme: {
      type: String,
      enum: {
        values: THEME_VALUES,
        message: `Theme must be one of: ${THEME_VALUES.join(", ")}`,
      },
      default: "light",
    },

    timezone: {
      type: String,
      trim: true,
      default: "UTC",
    },

    language: {
      type: String,
      enum: {
        values: LANGUAGE_VALUES,
        message: `Language must be one of: ${LANGUAGE_VALUES.join(", ")}`,
      },
      default: "en",
    },

    dateFormat: {
      type: String,
      enum: {
        values: DATE_FORMAT_VALUES,
        message: `Date format must be one of: ${DATE_FORMAT_VALUES.join(", ")}`,
      },
      default: "MMM D, YYYY",
    },

    timeFormat: {
      type: String,
      enum: {
        values: TIME_FORMAT_VALUES,
        message: `Time format must be one of: ${TIME_FORMAT_VALUES.join(", ")}`,
      },
      default: "12h",
    },

    dashboard: {
      type: dashboardPreferencesSchema,
      default: () => ({}),
    },
    notifications: { type: notificationPreferencesSchema, default: () => ({}) },
  },
  {
    timestamps: true,

    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        delete ret.user;
        return ret;
      },
    },

    toObject: { virtuals: true },
  },
);

// ── Indexes ──

// Enforces one preference document per user at the database level and
// backs the lookup every read/write does.
userPreferenceSchema.index({ user: 1 }, { unique: true });
userPreferenceSchema.index({
  "notifications.email.enabled": 1,
  "notifications.frequency": 1,
});

// ── Statics ──

/**
 * Fetches a user's preferences, lazily creating a default document on
 * first access. Preferences are never created at registration time — this
 * lazy-init pattern keeps the auth flow untouched and means a user who
 * never visits the Preferences page never gets a document at all.
 *
 * Guards against the race where two concurrent first-requests both miss
 * the initial findOne and try to create — the unique index on `user`
 * rejects the loser with E11000, which is caught and re-read instead of
 * surfacing a duplicate-key error to the caller.
 */
userPreferenceSchema.statics.getOrCreateForUser = async function (userId) {
  let prefs = await this.findOne({ user: userId });
  if (prefs) return prefs;

  try {
    prefs = await this.create({ user: userId });
  } catch (error) {
    if (error.code === 11000) {
      prefs = await this.findOne({ user: userId });
    } else {
      throw error;
    }
  }

  return prefs;
};

const UserPreference = mongoose.model("UserPreference", userPreferenceSchema);

export default UserPreference;
