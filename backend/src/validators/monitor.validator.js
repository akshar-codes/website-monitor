const { z } = require("zod");
const Monitor = require("../models/Monitor");
const normalizeUrl = require("../utils/normalizeUrl");

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
  .refine((v) => Monitor.INTERVAL_PRESETS.includes(v), {
    message: `Interval must be one of: ${Monitor.INTERVAL_PRESETS.join(", ")} (seconds)`,
  });

const activeField = z.boolean();

// ── Create schema — all required fields ──

const createMonitorSchema = z.object({
  name: nameField,
  url: urlField,
  interval: intervalField.optional().default(300),
  active: activeField.optional().default(true),
});

// ── Update schema — all fields optional, at least one required ──

const updateMonitorSchema = z
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

const listMonitorsSchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  active: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  sortBy: z
    .enum(["name", "url", "interval", "createdAt", "updatedAt"])
    .optional()
    .default("createdAt"),
  order: z.enum(["asc", "desc"]).optional().default("desc"),
});

module.exports = {
  createMonitorSchema,
  updateMonitorSchema,
  listMonitorsSchema,
};
