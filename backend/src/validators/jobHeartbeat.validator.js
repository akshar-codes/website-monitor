import { z } from "zod";

const parseDateString = (val) => {
  if (val === undefined || val === null || val === "") return undefined;
  const parsed = new Date(val);
  return isNaN(parsed.getTime()) ? null : parsed;
};

export const jobHeartbeatSchema = z
  .object({
    event: z.enum(["started", "succeeded", "failed"], {
      errorMap: () => ({
        message: 'Event must be one of: "started", "succeeded", "failed"',
      }),
    }),
    runId: z
      .string()
      .trim()
      .min(1, "runId cannot be empty")
      .max(128, "runId cannot exceed 128 characters")
      .optional(),
    scheduledFor: z.preprocess(parseDateString, z.date().optional().nullable()),
    startedAt: z.preprocess(parseDateString, z.date().optional().nullable()),
    completedAt: z.preprocess(parseDateString, z.date().optional().nullable()),
    durationMs: z
      .number()
      .min(0, "durationMs cannot be negative")
      .max(604800000, "durationMs cannot exceed 7 days")
      .optional()
      .nullable(),
    failureMessage: z
      .string()
      .trim()
      .max(1000, "failureMessage cannot exceed 1000 characters")
      .optional()
      .nullable(),
    errorMessage: z
      .string()
      .trim()
      .max(1000, "errorMessage cannot exceed 1000 characters")
      .optional()
      .nullable(),
    failureReason: z
      .string()
      .trim()
      .max(200, "failureReason cannot exceed 200 characters")
      .optional()
      .nullable(),
    output: z
      .string()
      .trim()
      .max(5000, "output cannot exceed 5000 characters")
      .optional()
      .nullable(),
    exitCode: z
      .number()
      .int("exitCode must be an integer")
      .min(-128, "exitCode must be >= -128")
      .max(255, "exitCode must be <= 255")
      .optional()
      .nullable(),
    metadata: z.record(z.any()).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    const now = Date.now();
    const futureLimit = now + 15 * 60 * 1000; // 15 minutes grace for clock drift
    const pastLimit = now - 30 * 24 * 60 * 60 * 1000; // 30 days

    if (data.startedAt) {
      if (data.startedAt.getTime() > futureLimit) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["startedAt"],
          message: "startedAt timestamp cannot be in the future",
        });
      }
      if (data.startedAt.getTime() < pastLimit) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["startedAt"],
          message: "startedAt timestamp cannot be older than 30 days",
        });
      }
    }

    if (data.completedAt) {
      if (data.completedAt.getTime() > futureLimit) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["completedAt"],
          message: "completedAt timestamp cannot be in the future",
        });
      }
      if (data.completedAt.getTime() < pastLimit) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["completedAt"],
          message: "completedAt timestamp cannot be older than 30 days",
        });
      }
    }

    if (data.startedAt && data.completedAt) {
      if (data.completedAt.getTime() < data.startedAt.getTime()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["completedAt"],
          message: "completedAt cannot precede startedAt",
        });
      }
    }
  });
