import { z } from "zod";
import mongoose from "mongoose";
import { objectIdSchema } from "./common.js";

const parseDateString = (val) => {
  if (val === undefined || val === null || val === "") return undefined;
  const parsed = new Date(val);
  return isNaN(parsed.getTime()) ? null : parsed;
};

const deployedAtSchema = z
  .unknown()
  .optional()
  .nullable()
  .superRefine((val, ctx) => {
    if (val === undefined || val === null || val === "") return;
    const date = new Date(val);
    if (isNaN(date.getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "deployedAt must be a valid date or timestamp",
      });
      return;
    }
    const now = Date.now();
    const maxFuture = now + 15 * 60 * 1000; // +15 minutes
    const maxPast = now - 30 * 24 * 60 * 60 * 1000; // -30 days

    if (date.getTime() > maxFuture) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "deployedAt cannot be more than 15 minutes in the future",
      });
      return;
    }

    if (date.getTime() < maxPast) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "deployedAt cannot be older than 30 days",
      });
      return;
    }
  })
  .transform((val) => {
    if (val === undefined || val === null || val === "") return undefined;
    return new Date(val);
  });

const optionalUrl = z
  .string()
  .trim()
  .max(2048, "URL cannot exceed 2048 characters")
  .refine(
    (val) => {
      if (!val) return true;
      try {
        const parsed = new URL(val);
        return ["http:", "https:"].includes(parsed.protocol);
      } catch {
        return false;
      }
    },
    { message: "Must be a valid HTTP or HTTPS URL" },
  )
  .optional()
  .nullable();

export const createDeploymentIntegrationSchema = z.object({
  name: z
    .string({ required_error: "Integration name is required" })
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(80, "Name cannot exceed 80 characters"),
  description: z
    .string()
    .trim()
    .max(500, "Description cannot exceed 500 characters")
    .optional()
    .nullable(),
  environment: z
    .string()
    .trim()
    .max(64, "Environment cannot exceed 64 characters")
    .optional()
    .nullable(),
  monitors: z.array(objectIdSchema).optional().default([]),
});

export const rotateDeploymentSecretSchema = z
  .object({
    immediateRevoke: z.boolean().optional(),
    immediateRevocation: z.boolean().optional(),
  })
  .transform((val) => ({
    immediateRevoke: Boolean(
      val.immediateRevoke != null
        ? val.immediateRevoke
        : val.immediateRevocation != null
          ? val.immediateRevocation
          : false,
    ),
  }));

export const ingestDeploymentEventSchema = z
  .object({
    monitors: z.array(z.string().trim()).optional(),
    monitorIds: z.array(z.string().trim()).optional(),
    monitorId: z.string().trim().optional(),
    version: z.string().trim().max(128).optional(),
    releaseVersion: z.string().trim().max(128).optional(),
    release: z.string().trim().max(128).optional(),
    releaseName: z.string().trim().max(128).optional(),
    commitSha: z.string().trim().max(64).optional().nullable(),
    commit: z.string().trim().max(64).optional().nullable(),
    environment: z
      .string()
      .trim()
      .max(64)
      .optional()
      .nullable()
      .transform((val) => (val && val.trim() ? val.trim() : undefined)),
    deployedAt: deployedAtSchema,
    source: z.string().trim().max(64).optional().default("custom"),
    url: optionalUrl,
    deploymentUrl: optionalUrl,
    description: z
      .string()
      .trim()
      .max(2000, "Description cannot exceed 2000 characters")
      .optional()
      .nullable(),
    externalId: z.string().trim().max(256).optional().nullable(),
    idempotencyKey: z.string().trim().max(256).optional().nullable(),
    deploymentId: z.string().trim().max(256).optional().nullable(),
    metadata: z.record(z.unknown()).optional(),
    owner: z.unknown().optional(), // Silently ignored if passed; never trusted
    ownerId: z.unknown().optional(),
  })
  .superRefine((data, ctx) => {
    // 1. Validate monitors presence and format
    const rawMonitors = [
      ...(data.monitors || []),
      ...(data.monitorIds || []),
      ...(data.monitorId ? [data.monitorId] : []),
    ];

    if (rawMonitors.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["monitors"],
        message: "At least one monitor reference is required",
      });
    } else {
      for (let i = 0; i < rawMonitors.length; i++) {
        if (!mongoose.Types.ObjectId.isValid(rawMonitors[i])) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["monitors", i],
            message: `Invalid monitor ID format: ${rawMonitors[i]}`,
          });
        }
      }
    }

    // 2. Validate release version or name
    const versionValue =
      data.version || data.releaseVersion || data.release || data.releaseName;
    if (!versionValue || !versionValue.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["version"],
        message: "Release version or name is required",
      });
    }
  });

export const listDeploymentEventsQuerySchema = z.object({
  monitorId: objectIdSchema.optional(),
  environment: z.string().trim().max(64).optional(),
  source: z.string().trim().max(64).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  startDate: z.preprocess(parseDateString, z.date().optional()),
  endDate: z.preprocess(parseDateString, z.date().optional()),
});

export const monitorDeploymentsQuerySchema = z.object({
  window: z.enum(["24h", "7d", "30d"]).optional(),
  environment: z.string().trim().max(64).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  sortBy: z
    .enum(["deployedAt", "createdAt", "version"])
    .optional()
    .default("deployedAt"),
  order: z.enum(["asc", "desc"]).optional().default("desc"),
  startDate: z.preprocess(parseDateString, z.date().optional()),
  endDate: z.preprocess(parseDateString, z.date().optional()),
});

export const deploymentImpactQuerySchema = z.object({
  windowMinutes: z.coerce
    .number()
    .int()
    .min(5)
    .max(1440)
    .optional()
    .default(30),
  window: z.string().trim().optional(),
});
