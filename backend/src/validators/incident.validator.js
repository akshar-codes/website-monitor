import { z } from "zod";
import { optionalObjectIdSchema } from "./common.js";

export const listIncidentsSchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  severity: z.enum(["critical", "major", "minor"]).optional(),
  status: z
    .enum(["active", "ongoing", "investigating", "identified", "resolved"])
    .optional()
    .default("active"),
  monitorId: optionalObjectIdSchema,
});

export const updateStatusSchema = z.object({
  status: z.enum(["investigating", "identified", "resolved"]),
  rootCause: z.string().max(2000).optional(),
  resolutionNotes: z.string().max(5000).optional(),
});

export const downtimeStatsSchema = z.object({
  monitorId: optionalObjectIdSchema,
  window: z.enum(["24h", "7d", "30d"]).optional().default("30d"),
});
