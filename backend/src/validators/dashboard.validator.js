import { z } from "zod";
import { optionalObjectIdSchema } from "./common.js";

// ── Active incidents listing ──

export const incidentsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  severity: z.enum(["critical", "major", "minor"]).optional(),
});

// ── Recent health checks listing ──

export const healthChecksQuerySchema = z.object({
  monitorId: optionalObjectIdSchema,
  status: z.enum(["up", "down", "degraded", "unknown"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

// ── Per-monitor stats ──

export const monitorStatsQuerySchema = z.object({
  window: z.enum(["24h", "7d", "30d"]).optional().default("24h"),
});
