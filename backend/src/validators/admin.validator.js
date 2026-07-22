import { z } from "zod";
import { ROLE_VALUES } from "../config/constants.js";

// ── List users ──

export const listUsersSchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  role: z.enum(ROLE_VALUES).optional(),
});

// ── Update a user's role ──

export const updateUserRoleSchema = z.object({
  role: z.enum(ROLE_VALUES, {
    required_error: "Role is required",
    invalid_type_error: `Role must be one of: ${ROLE_VALUES.join(", ")}`,
  }),
});
