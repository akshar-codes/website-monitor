import { z } from "zod";
import {
  THEME_VALUES,
  LANGUAGE_VALUES,
  DATE_FORMAT_VALUES,
  TIME_FORMAT_VALUES,
  DASHBOARD_REFRESH_INTERVALS,
  WIDGET_KEYS,
} from "../config/preferenceConstants.js";
import { WINDOW_KEYS } from "../config/constants.js";
import { isValidTimezone } from "../utils/timezone.js";

// ── Shared field definitions ──

const timezoneField = z
  .string({ required_error: "Timezone is required" })
  .trim()
  .min(1, "Timezone is required")
  .max(100, "Timezone cannot exceed 100 characters")
  .refine(isValidTimezone, {
    message: "Must be a valid IANA timezone identifier (e.g. America/New_York)",
  });

// ── General preferences (theme, timezone, language, date/time format) ──

export const updatePreferencesSchema = z
  .object({
    theme: z.enum(THEME_VALUES).optional(),
    timezone: timezoneField.optional(),
    language: z.enum(LANGUAGE_VALUES).optional(),
    dateFormat: z.enum(DATE_FORMAT_VALUES).optional(),
    timeFormat: z.enum(TIME_FORMAT_VALUES).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one preference field must be provided",
  });

// ── Dashboard customization ──

const dashboardWidgetsSchema = z.object({
  showQuickActions: z.boolean().optional(),
  showOverviewChart: z.boolean().optional(),
  showRecentActivity: z.boolean().optional(),
  showActiveIncidents: z.boolean().optional(),
  showMonitorStatusGrid: z.boolean().optional(),
});

export const updateDashboardPreferencesSchema = z
  .object({
    defaultWindow: z.enum(WINDOW_KEYS).optional(),
    autoRefreshInterval: z.coerce
      .number()
      .int()
      .refine((v) => DASHBOARD_REFRESH_INTERVALS.includes(v), {
        message: `Auto-refresh interval must be one of: ${DASHBOARD_REFRESH_INTERVALS.join(", ")} (seconds)`,
      })
      .optional(),
    compactMode: z.boolean().optional(),
    widgets: dashboardWidgetsSchema.optional(),
    widgetOrder: z
      .array(z.enum(WIDGET_KEYS))
      .refine((arr) => new Set(arr).size === arr.length, {
        message: "widgetOrder cannot contain duplicate widgets",
      })
      .refine((arr) => arr.length === WIDGET_KEYS.length, {
        message: `widgetOrder must include every widget exactly once: ${WIDGET_KEYS.join(", ")}`,
      })
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one dashboard preference field must be provided",
  });

const notificationSwitchesSchema = z.object({
  monitorDown: z.boolean().optional(),
  monitorRecovery: z.boolean().optional(),
  sslExpiry: z.boolean().optional(),
  incidents: z.boolean().optional(),
  billing: z.boolean().optional(),
  accountSecurity: z.boolean().optional(),
  systemAnnouncements: z.boolean().optional(),
});
export const updateNotificationPreferencesSchema = z
  .object({
    inApp: notificationSwitchesSchema.optional(),
    email: z
      .object({
        enabled: z.boolean().optional(),
        monitorDown: z.boolean().optional(),
        monitorRecovery: z.boolean().optional(),
        sslExpiry: z.boolean().optional(),
        incidents: z.boolean().optional(),
      })
      .optional(),
    frequency: z.enum(["immediate", "daily", "weekly"]).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one notification preference must be provided",
  });
