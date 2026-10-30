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

// ── Admin: approve ────────────────────────────────────────────────────────────

export const approvePlanUpgradeRequestSchema = z
  .object({
    grantedPlan: z
      .enum(PLAN_VALUES, {
        invalid_type_error: `Granted plan must be one of: ${PLAN_VALUES.join(", ")}`,
      })
      .optional(),
    paymentRequired: z.boolean().optional().default(false),
    period: z.enum(["monthly", "yearly"]).optional().default("monthly"),
    discountPercent: z.coerce.number().min(0).max(100).optional().default(0),
    planExpiresAt: z.string().datetime({ offset: true }).optional(),
    reason: z.string().trim().min(3).max(500),
    expiresAt: z.string().datetime({ offset: true }).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.expiresAt && new Date(value.expiresAt) <= new Date())
      ctx.addIssue({
        code: "custom",
        path: ["expiresAt"],
        message: "Expiry must be in the future",
      });
    if (value.planExpiresAt && new Date(value.planExpiresAt) <= new Date())
      ctx.addIssue({
        code: "custom",
        path: ["planExpiresAt"],
        message: "Plan expiry must be in the future",
      });
  });

// ── Admin: reject ─────────────────────────────────────────────────────────────

export const rejectPlanUpgradeRequestSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "A rejection reason is required")
    .max(500, "Reason cannot exceed 500 characters"),
});
