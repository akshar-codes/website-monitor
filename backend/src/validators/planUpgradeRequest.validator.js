import { z } from "zod";
import {
  PLAN_VALUES,
  PLAN_UPGRADE_REQUEST_STATUS_VALUES,
} from "../config/constants.js";

// ── Create (user-facing) ──────────────────────────────────────────────────────

export const createPlanUpgradeRequestSchema = z.object({
  requestedPlan: z.enum(PLAN_VALUES, {
    required_error: "Requested plan is required",
    invalid_type_error: `Requested plan must be one of: ${PLAN_VALUES.join(", ")}`,
  }),
});

// ── Admin: list ────────────────────────────────────────────────────────────────

export const listPlanUpgradeRequestsSchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  status: z.enum(PLAN_UPGRADE_REQUEST_STATUS_VALUES).optional(),
});

// ── Admin: reject ─────────────────────────────────────────────────────────────

export const rejectPlanUpgradeRequestSchema = z.object({
  reason: z
    .string()
    .trim()
    .max(500, "Reason cannot exceed 500 characters")
    .optional(),
});
