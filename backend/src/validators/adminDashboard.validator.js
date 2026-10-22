import { z } from "zod";

const isoDate = z
  .string()
  .datetime({ offset: true })
  .transform((value) => new Date(value));
export const adminDashboardQuerySchema = z
  .object({
    startDate: isoDate.optional(),
    endDate: isoDate.optional(),
  })
  .superRefine((value, ctx) => {
    const endDate = value.endDate || new Date();
    const startDate =
      value.startDate || new Date(endDate.getTime() - 30 * 86400000);
    if (startDate > endDate)
      ctx.addIssue({
        code: "custom",
        path: ["startDate"],
        message: "Start date must be before end date",
      });
    if (endDate.getTime() - startDate.getTime() > 366 * 86400000)
      ctx.addIssue({
        code: "custom",
        path: ["startDate"],
        message: "Date range cannot exceed 366 days",
      });
  });
