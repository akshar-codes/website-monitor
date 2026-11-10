import { z } from "zod";
import { objectIdSchema } from "./common.js";
import {
  JOB_SCHEDULE_TYPE_VALUES,
  JOB_SCHEDULE_TYPES,
  JOB_STATUS_VALUES,
  JOB_RUN_STATUS_VALUES,
  JOB_SORT_FIELDS,
  JOB_MONITOR_LIMITS,
} from "../config/constants.js";
import {
  isValidCron,
  isValidTimezone,
} from "../services/jobSchedule.service.js";

const nameField = z
  .string({ required_error: "Job monitor name is required" })
  .trim()
  .min(1, "Job monitor name cannot be empty")
  .max(120, "Job monitor name cannot exceed 120 characters");

const descriptionField = z
  .string()
  .trim()
  .max(1000, "Description cannot exceed 1000 characters")
  .optional()
  .default("");

const scheduleTypeField = z
  .enum(JOB_SCHEDULE_TYPE_VALUES, {
    errorMap: () => ({
      message: `Schedule type must be one of: ${JOB_SCHEDULE_TYPE_VALUES.join(", ")}`,
    }),
  })
  .default(JOB_SCHEDULE_TYPES.INTERVAL);

const intervalSecondsField = z
  .number()
  .int("Interval must be an integer")
  .min(
    JOB_MONITOR_LIMITS.MIN_INTERVAL_SECONDS,
    `Interval must be at least ${JOB_MONITOR_LIMITS.MIN_INTERVAL_SECONDS} seconds`,
  )
  .max(
    JOB_MONITOR_LIMITS.MAX_INTERVAL_SECONDS,
    `Interval cannot exceed ${JOB_MONITOR_LIMITS.MAX_INTERVAL_SECONDS} seconds`,
  )
  .optional()
  .nullable();

const cronExpressionField = z
  .string()
  .trim()
  .max(100, "Cron expression cannot exceed 100 characters")
  .optional()
  .nullable();

const timezoneField = z.string().trim().default("UTC");

const gracePeriodSecondsField = z
  .number()
  .int("Grace period must be an integer")
  .min(
    JOB_MONITOR_LIMITS.MIN_GRACE_PERIOD_SECONDS,
    `Grace period must be at least ${JOB_MONITOR_LIMITS.MIN_GRACE_PERIOD_SECONDS} seconds`,
  )
  .max(
    JOB_MONITOR_LIMITS.MAX_GRACE_PERIOD_SECONDS,
    `Grace period cannot exceed ${JOB_MONITOR_LIMITS.MAX_GRACE_PERIOD_SECONDS} seconds`,
  )
  .default(JOB_MONITOR_LIMITS.DEFAULT_GRACE_PERIOD_SECONDS);

const runTimeoutSecondsField = z
  .number()
  .int("Run timeout must be an integer")
  .min(
    JOB_MONITOR_LIMITS.MIN_RUN_TIMEOUT_SECONDS,
    `Run timeout must be at least ${JOB_MONITOR_LIMITS.MIN_RUN_TIMEOUT_SECONDS} seconds`,
  )
  .max(
    JOB_MONITOR_LIMITS.MAX_RUN_TIMEOUT_SECONDS,
    `Run timeout cannot exceed ${JOB_MONITOR_LIMITS.MAX_RUN_TIMEOUT_SECONDS} seconds`,
  )
  .default(JOB_MONITOR_LIMITS.DEFAULT_RUN_TIMEOUT_SECONDS);

const failureThresholdField = z
  .number()
  .int()
  .min(JOB_MONITOR_LIMITS.MIN_FAILURE_THRESHOLD)
  .max(JOB_MONITOR_LIMITS.MAX_FAILURE_THRESHOLD)
  .default(JOB_MONITOR_LIMITS.DEFAULT_FAILURE_THRESHOLD);

const recoveryThresholdField = z
  .number()
  .int()
  .min(JOB_MONITOR_LIMITS.MIN_RECOVERY_THRESHOLD)
  .max(JOB_MONITOR_LIMITS.MAX_RECOVERY_THRESHOLD)
  .default(JOB_MONITOR_LIMITS.DEFAULT_RECOVERY_THRESHOLD);

export const createJobMonitorSchema = z
  .object({
    name: nameField,
    description: descriptionField,
    scheduleType: scheduleTypeField,
    intervalSeconds: intervalSecondsField,
    cronExpression: cronExpressionField,
    timezone: timezoneField,
    gracePeriodSeconds: gracePeriodSecondsField,
    runTimeoutSeconds: runTimeoutSecondsField,
    failureThreshold: failureThresholdField,
    recoveryThreshold: recoveryThresholdField,
    active: z.boolean().default(true),
    integrationIds: z.array(objectIdSchema).optional().default([]),
  })
  .superRefine((data, ctx) => {
    if (data.scheduleType === JOB_SCHEDULE_TYPES.INTERVAL) {
      if (!data.intervalSeconds) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["intervalSeconds"],
          message: "intervalSeconds is required for interval schedules",
        });
      }
    } else if (data.scheduleType === JOB_SCHEDULE_TYPES.CRON) {
      if (!data.cronExpression) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["cronExpression"],
          message: "cronExpression is required for cron schedules",
        });
      } else if (!isValidCron(data.cronExpression)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["cronExpression"],
          message: `"${data.cronExpression}" is not a valid cron expression`,
        });
      }
    }

    if (data.timezone && !isValidTimezone(data.timezone)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["timezone"],
        message: `"${data.timezone}" is not a recognized IANA timezone`,
      });
    }
  });

export const updateJobMonitorSchema = z
  .object({
    name: nameField.optional(),
    description: descriptionField.optional(),
    scheduleType: z.enum(JOB_SCHEDULE_TYPE_VALUES).optional(),
    intervalSeconds: intervalSecondsField,
    cronExpression: cronExpressionField,
    timezone: z.string().trim().optional(),
    gracePeriodSeconds: gracePeriodSecondsField.optional(),
    runTimeoutSeconds: runTimeoutSecondsField.optional(),
    failureThreshold: failureThresholdField.optional(),
    recoveryThreshold: recoveryThresholdField.optional(),
    active: z.boolean().optional(),
    integrationIds: z.array(objectIdSchema).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.cronExpression && !isValidCron(data.cronExpression)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cronExpression"],
        message: `"${data.cronExpression}" is not a valid cron expression`,
      });
    }
    if (data.timezone && !isValidTimezone(data.timezone)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["timezone"],
        message: `"${data.timezone}" is not a recognized IANA timezone`,
      });
    }
  });

export const listJobMonitorsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  status: z.enum(["all", ...JOB_STATUS_VALUES]).default("all"),
  scheduleType: z.enum(["all", ...JOB_SCHEDULE_TYPE_VALUES]).default("all"),
  active: z
    .preprocess((val) => {
      if (val === "true" || val === true) return true;
      if (val === "false" || val === false) return false;
      return undefined;
    }, z.boolean().optional())
    .optional(),
  sortBy: z.enum(JOB_SORT_FIELDS).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const listJobRunsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["all", ...JOB_RUN_STATUS_VALUES]).default("all"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});
