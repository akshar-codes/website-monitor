import { z } from "zod";
import mongoose from "mongoose";

const id = z
  .string()
  .refine((value) => mongoose.Types.ObjectId.isValid(value), "Invalid ID")
  .optional();
const date = z
  .string()
  .datetime({ offset: true })
  .transform((value) => new Date(value));
export const adminAuditQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    startDate: date.optional(),
    endDate: date.optional(),
    actorId: id,
    targetId: id,
    category: z.enum(["admin", "auth", "session"]).optional(),
    outcome: z.enum(["success", "failure"]).optional(),
    search: z.string().trim().max(160).optional(),
  })
  .superRefine((value, ctx) => {
    if (Boolean(value.startDate) !== Boolean(value.endDate))
      ctx.addIssue({
        code: "custom",
        path: [value.startDate ? "endDate" : "startDate"],
        message: "Provide both startDate and endDate",
      });
    if (value.startDate && value.endDate && value.startDate > value.endDate)
      ctx.addIssue({
        code: "custom",
        path: ["startDate"],
        message: "Start date must not be after end date",
      });
    if (
      value.startDate &&
      value.endDate &&
      value.endDate - value.startDate > 366 * 86400000
    )
      ctx.addIssue({
        code: "custom",
        path: ["startDate"],
        message: "Date range cannot exceed 366 days",
      });
  });
