import { z } from "zod";
import { optionalObjectIdSchema } from "./common.js";
import {
  INCIDENT_SEVERITY,
  INCIDENT_STATUS,
  INCIDENT_STATUS_FILTER_ACTIVE,
  INCIDENT_STATUS_FILTER_ALL,
  WINDOW_KEYS,
} from "../config/constants.js";

const SEVERITY_VALUES = Object.values(INCIDENT_SEVERITY);
const STATUS_VALUES = Object.values(INCIDENT_STATUS);

const isoDateField = z.coerce.date({
  invalid_type_error: "Must be a valid date",
});

export const listIncidentsSchema = z
  .object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    severity: z.enum(SEVERITY_VALUES).optional(),
    // Defaults to "active" (non-resolved only) for backward compatibility
    // with existing callers (the Insights page's incident preview). Full
    // history views pass INCIDENT_STATUS_FILTER_ALL explicitly to see
    // every incident regardless of status.
    status: z
      .enum([
        INCIDENT_STATUS_FILTER_ACTIVE,
        INCIDENT_STATUS_FILTER_ALL,
        ...STATUS_VALUES,
      ])
      .optional()
      .default(INCIDENT_STATUS_FILTER_ACTIVE),
    monitorId: optionalObjectIdSchema,
    // Free-text search — matched against the owning monitor's name/URL and
    // the incident's own rootCause/resolutionNotes (see incident.service.js).
    search: z
      .string()
      .trim()
      .max(200, "Search term cannot exceed 200 characters")
      .optional(),
    // Either a window preset OR an explicit startDate/endDate pair — never
    // both (enforced below), mirroring analyticsQuerySchema's pattern.
    window: z.enum(WINDOW_KEYS).optional(),
    startDate: isoDateField.optional(),
    endDate: isoDateField.optional(),
    order: z.enum(["asc", "desc"]).optional().default("desc"),
  })
  .superRefine((data, ctx) => {
    const hasStart = data.startDate !== undefined;
    const hasEnd = data.endDate !== undefined;

    if (hasStart !== hasEnd) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Both startDate and endDate are required to use a custom date range",
        path: [hasStart ? "endDate" : "startDate"],
      });
      return;
    }

    if (!hasStart) return; // no custom range supplied — window (or none) applies

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

export const updateStatusSchema = z.object({
  status: z.enum([
    INCIDENT_STATUS.INVESTIGATING,
    INCIDENT_STATUS.IDENTIFIED,
    INCIDENT_STATUS.RESOLVED,
  ]),
  rootCause: z.string().max(2000).optional(),
  resolutionNotes: z.string().max(5000).optional(),
});

export const downtimeStatsSchema = z.object({
  monitorId: optionalObjectIdSchema,
  window: z.enum(WINDOW_KEYS).optional().default("30d"),
});
