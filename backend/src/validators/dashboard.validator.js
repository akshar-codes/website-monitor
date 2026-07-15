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
