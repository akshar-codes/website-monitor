import { z } from "zod";
import { ROLE_VALUES, PLAN_VALUES } from "../config/constants.js";

/**
 * Not a real persisted field — `active` on the User model is a boolean.
 * This is the query-param vocabulary for filtering by it, kept as its own
 * enum so the accepted values are validated the same way every other
 * filter is (see WINDOW_KEYS / INCIDENT_STATUS_FILTER_ACTIVE for the same
 * pattern elsewhere in the codebase).
 */
export const USER_STATUS_FILTER_VALUES = Object.freeze(["active", "suspended"]);

// ── List / search / filter users ──

export const listUsersSchema = z
  .object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    role: z.enum(ROLE_VALUES).optional(),
    plan: z.enum(PLAN_VALUES).optional(),
    status: z.enum(USER_STATUS_FILTER_VALUES).optional(),
    search: z
      .string()
      .trim()
      .max(120, "Search term cannot exceed 120 characters")
      .optional(),
    registeredFrom: z.string().datetime({ offset: true }).optional(),
    registeredTo: z.string().datetime({ offset: true }).optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.registeredFrom &&
      value.registeredTo &&
      new Date(value.registeredFrom) > new Date(value.registeredTo)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["registeredFrom"],
        message: "Registration start must be before end",
      });
    }
  });

// ── Update a user's role ──

export const updateUserRoleSchema = z.object({
  role: z.enum(ROLE_VALUES, {
    required_error: "Role is required",
    invalid_type_error: `Role must be one of: ${ROLE_VALUES.join(", ")}`,
  }),
  reason: z.string().trim().min(3).max(500),
});

export const userStatusReasonSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

// ── Update a user's subscription plan ──

export const updateUserPlanSchema = z
  .object({
    plan: z.enum(PLAN_VALUES, {
      required_error: "Plan is required",
      invalid_type_error: `Plan must be one of: ${PLAN_VALUES.join(", ")}`,
    }),
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
  });
