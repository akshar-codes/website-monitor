const { z } = require("zod");

// ── Active incidents listing ──

const incidentsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  severity: z.enum(["critical", "major", "minor"]).optional(),
});

// ── Recent health checks listing ──

const healthChecksQuerySchema = z.object({
  monitorId: z.string().optional(),
  status: z.enum(["up", "down", "degraded", "unknown"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

// ── Per-monitor stats ──

const monitorStatsQuerySchema = z.object({
  window: z.enum(["24h", "7d", "30d"]).optional().default("24h"),
});

module.exports = {
  incidentsQuerySchema,
  healthChecksQuerySchema,
  monitorStatsQuerySchema,
};
