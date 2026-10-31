import { z } from "zod";
import mongoose from "mongoose";
import {
  HEALTH_STATUS,
  INCIDENT_SEVERITY,
  INCIDENT_STATUS,
  PLAN_VALUES,
} from "../config/constants.js";

const objectId = z
  .string()
  .refine((value) => mongoose.Types.ObjectId.isValid(value), "Invalid ID")
  .optional();
const dateRange = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(150).optional(),
  ownerId: objectId,
  plan: z.enum(PLAN_VALUES).optional(),
  status: z
    .enum(["active", "paused", ...Object.values(HEALTH_STATUS)])
    .optional(),
  incidentState: z.enum(["active", "resolved", "none"]).optional(),
});
export const adminMonitorListSchema = dateRange;
export const adminIncidentListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(150).optional(),
  ownerId: objectId,
  activeOnly: z.coerce.boolean().optional(),
  severity: z.enum(Object.values(INCIDENT_SEVERITY)).optional(),
  status: z.enum(Object.values(INCIDENT_STATUS)).optional(),
});
export const adminMonitorDetailSchema = z.object({
  window: z.enum(["24h", "7d", "30d", "90d"]).default("30d"),
});
export const resolveAdminIncidentSchema = z.object({
  resolutionNotes: z.string().trim().min(3).max(5000),
  rootCause: z.string().trim().max(2000).optional(),
});
