import { z } from "zod";
import normalizeUrl from "../utils/normalizeUrl.js";
import { INTERVAL_PRESETS, MONITOR_SORT_FIELDS } from "../config/constants.js";

// ── Shared field definitions ──

const nameField = z
  .string({ required_error: "Name is required" })
  .trim()
  .min(1, "Name cannot be empty")
  .max(120, "Name cannot exceed 120 characters");

const urlField = z
  .string({ required_error: "URL is required" })
  .trim()
  .refine(
    (v) => {
      try {
        const parsed = new URL(v);
        return ["http:", "https:"].includes(parsed.protocol);
      } catch {
        return false;
      }
    },
    { message: "Must be a valid HTTP or HTTPS URL" },
  )
  // Normalise after validation so storage is canonical
  .transform((v) => normalizeUrl(v));

const intervalField = z
  .number({ required_error: "Interval is required" })
  .int("Interval must be a whole number")
  .min(30, "Interval must be at least 30 seconds")
  .refine((v) => INTERVAL_PRESETS.includes(v), {
    message: `Interval must be one of: ${INTERVAL_PRESETS.join(", ")} (seconds)`,
  });

const activeField = z.boolean();

// ── Create schema — all required fields ──

export const createMonitorSchema = z.object({
  name: nameField,
  url: urlField,
  interval: intervalField.optional().default(300),
  active: activeField.optional().default(true),
});

// ── Update schema — all fields optional, at least one required ──

export const updateMonitorSchema = z
  .object({
    name: nameField.optional(),
    url: urlField.optional(),
    interval: intervalField.optional(),
    active: activeField.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update",
  });

// ── Query params for listing ──

export const listMonitorsSchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  active: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  sortBy: z.enum(MONITOR_SORT_FIELDS).optional().default("createdAt"),
  order: z.enum(["asc", "desc"]).optional().default("desc"),
});
