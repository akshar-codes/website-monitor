import { z } from "zod";
import { optionalObjectIdSchema } from "./common.js";
import {
  INCIDENT_SEVERITY,
  HEALTH_STATUS,
  WINDOW_KEYS,
} from "../config/constants.js";

// ── Active incidents listing ──

export const incidentsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  severity: z.enum(Object.values(INCIDENT_SEVERITY)).optional(),
});

// ── Recent health checks listing ──

export const healthChecksQuerySchema = z.object({
  monitorId: optionalObjectIdSchema,
  status: z.enum(Object.values(HEALTH_STATUS)).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

// ── Per-monitor stats ──

export const monitorStatsQuerySchema = z.object({
  window: z.enum(WINDOW_KEYS).optional().default("24h"),
});

// ── Per-monitor analytics / performance insights ──

const isoDateField = z.coerce.date({
  invalid_type_error: "Must be a valid date",
});

export const analyticsQuerySchema = z
  .object({
    window: z.enum(WINDOW_KEYS).optional(),
    startDate: isoDateField.optional(),
    endDate: isoDateField.optional(),
  })
  .superRefine((data, ctx) => {
    const hasStart = data.startDate !== undefined;
    const hasEnd = data.endDate !== undefined;

    // Partial custom range — only one of the two bounds was supplied.
    if (hasStart !== hasEnd) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Both startDate and endDate are required to use a custom date range",
        path: [hasStart ? "endDate" : "startDate"],
      });
      return;
    }

    if (!hasStart) return; // no custom range supplied — window (or default) applies

    if (data.window) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Provide either a window preset or a custom date range, not both",
        path: ["window"],
      });
    }

    if (data.startDate.getTime() > data.endDate.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "startDate must be before or equal to endDate",
        path: ["startDate"],
      });
    }

    // A small clock-skew allowance (5 minutes) avoids rejecting a request
    // built with "now" on a client whose clock is slightly ahead.
    const CLOCK_SKEW_MS = 5 * 60 * 1000;
    if (data.endDate.getTime() > Date.now() + CLOCK_SKEW_MS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "endDate cannot be in the future",
        path: ["endDate"],
      });
    }
  });
