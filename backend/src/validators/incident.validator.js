import { z } from "zod";
import { optionalObjectIdSchema } from "./common.js";
import {
  INCIDENT_SEVERITY,
  INCIDENT_STATUS,
  INCIDENT_STATUS_FILTER_ACTIVE,
  WINDOW_KEYS,
} from "../config/constants.js";

const SEVERITY_VALUES = Object.values(INCIDENT_SEVERITY);
const STATUS_VALUES = Object.values(INCIDENT_STATUS);

export const listIncidentsSchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  severity: z.enum(SEVERITY_VALUES).optional(),
  status: z
    .enum([INCIDENT_STATUS_FILTER_ACTIVE, ...STATUS_VALUES])
    .optional()
    .default(INCIDENT_STATUS_FILTER_ACTIVE),
  monitorId: optionalObjectIdSchema,
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
