import { z } from "zod";
import { objectIdSchema } from "./common.js";
import {
  SLO_ROLLING_WINDOWS,
  SLO_EVALUATION_INTERVALS,
  SLO_BURN_RATE_WINDOWS,
  SLO_SEVERITY,
  SLO_SORT_FIELDS,
} from "../config/constants.js";

const nameField = z
  .string({ required_error: "SLO name is required" })
  .trim()
  .min(1, "SLO name cannot be empty")
  .max(120, "SLO name cannot exceed 120 characters");

const descriptionField = z
  .string()
  .trim()
  .max(1000, "Description cannot exceed 1000 characters")
  .optional()
  .default("");

const targetPercentageField = z
  .number({ required_error: "Target percentage is required" })
  .min(50, "Target percentage must be between 50 and 100")
  .max(100, "Target percentage must be between 50 and 100");

const burnRateThresholdSchema = z.object({
  window: z.enum(SLO_BURN_RATE_WINDOWS, {
    errorMap: () => ({
      message: `Burn rate window must be one of: ${SLO_BURN_RATE_WINDOWS.join(", ")}`,
    }),
  }),
  rate: z
    .number()
    .min(0.1, "Burn rate must be at least 0.1")
    .max(100, "Burn rate cannot exceed 100"),
  severity: z
    .enum(SLO_SEVERITY, {
      errorMap: () => ({
        message: `Severity must be one of: ${SLO_SEVERITY.join(", ")}`,
      }),
    })
    .default("critical"),
});

const alertSettingsSchema = z
  .object({
    burnRateAlertsEnabled: z.boolean().default(true),
    burnRateThresholds: z
      .array(burnRateThresholdSchema)
      .max(10, "Cannot configure more than 10 burn rate thresholds")
      .default([
        { window: "1h", rate: 14.4, severity: "critical" },
        { window: "6h", rate: 6.0, severity: "high" },
      ]),
    budgetExhaustedAlert: z.boolean().default(true),
    budgetWarningThresholdPercent: z
      .number()
      .min(1, "Warning threshold must be at least 1%")
      .max(50, "Warning threshold cannot exceed 50%")
      .default(20),
    cooldownMinutes: z
      .number()
      .min(5, "Cooldown must be at least 5 minutes")
      .max(1440, "Cooldown cannot exceed 24 hours")
      .default(60),
    integrationIds: z.array(objectIdSchema).default([]),
  })
  .default({});

const measurementContractSchema = z
  .object({
    maxIntervalAttributionSeconds: z
      .number()
      .min(30, "Attribution ceiling must be at least 30 seconds")
      .max(86400, "Attribution ceiling cannot exceed 86400 seconds")
      .default(3600),
    minimumDataCoveragePercent: z
      .number()
      .min(50, "Minimum data coverage must be at least 50%")
      .max(100, "Minimum data coverage cannot exceed 100%")
      .default(95.0),
    excludeMaintenance: z.boolean().default(true),
    countDegradedAsDown: z.boolean().default(true),
  })
  .default({});

export const createSloSchema = z.object({
  name: nameField,
  description: descriptionField,
  monitorId: objectIdSchema,
  targetPercentage: targetPercentageField,
  rollingWindow: z
    .enum(SLO_ROLLING_WINDOWS, {
      errorMap: () => ({
        message: `Rolling window must be one of: ${SLO_ROLLING_WINDOWS.join(", ")}`,
      }),
    })
    .default("30d"),
  evaluationInterval: z
    .enum(SLO_EVALUATION_INTERVALS, {
      errorMap: () => ({
        message: `Evaluation interval must be one of: ${SLO_EVALUATION_INTERVALS.join(", ")}`,
      }),
    })
    .default("1h"),
  enabled: z.boolean().default(true),
  alertSettings: alertSettingsSchema.default(() =>
    alertSettingsSchema.parse({}),
  ),
  measurementContract: measurementContractSchema.default(() =>
    measurementContractSchema.parse({}),
  ),
});

export const updateSloSchema = z.object({
  name: nameField.optional(),
  description: descriptionField,
  targetPercentage: targetPercentageField.optional(),
  rollingWindow: z
    .enum(SLO_ROLLING_WINDOWS, {
      errorMap: () => ({
        message: `Rolling window must be one of: ${SLO_ROLLING_WINDOWS.join(", ")}`,
      }),
    })
    .optional(),
  evaluationInterval: z
    .enum(SLO_EVALUATION_INTERVALS, {
      errorMap: () => ({
        message: `Evaluation interval must be one of: ${SLO_EVALUATION_INTERVALS.join(", ")}`,
      }),
    })
    .optional(),
  enabled: z.boolean().optional(),
  alertSettings: alertSettingsSchema.optional(),
  measurementContract: measurementContractSchema.optional(),
  changeReason: z
    .string()
    .trim()
    .max(500, "Change reason cannot exceed 500 characters")
    .optional(),
});

export const listSlosSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  monitorId: objectIdSchema.optional(),
  enabled: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .or(z.boolean())
    .optional(),
  search: z.string().trim().max(100).optional(),
  sortBy: z.enum(SLO_SORT_FIELDS).default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
});
