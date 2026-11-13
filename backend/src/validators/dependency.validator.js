import { z } from "zod";
import { objectIdSchema, optionalObjectIdSchema } from "./common.js";
import {
  DEPENDENCY_TYPE_VALUES,
  DEPENDENCY_TARGET_TYPE_VALUES,
  DEPENDENCY_SORT_FIELDS,
} from "../config/constants.js";

const descriptionField = z
  .string()
  .trim()
  .max(500, "Description cannot exceed 500 characters")
  .optional()
  .default("");

const dependencyTypeField = z
  .enum(DEPENDENCY_TYPE_VALUES, {
    errorMap: () => ({
      message: `Dependency type must be one of: ${DEPENDENCY_TYPE_VALUES.join(", ")}`,
    }),
  })
  .default("hard");

const targetTypeField = z
  .enum(DEPENDENCY_TARGET_TYPE_VALUES, {
    errorMap: () => ({
      message: `Target type must be one of: ${DEPENDENCY_TARGET_TYPE_VALUES.join(", ")}`,
    }),
  })
  .default("monitor");

export const createDependencySchema = z
  .object({
    dependentMonitorId: objectIdSchema,
    toType: targetTypeField,
    dependencyMonitorId: optionalObjectIdSchema,
    dependencyExternalServiceId: optionalObjectIdSchema,
    dependencyType: dependencyTypeField,
    description: descriptionField,
  })
  .refine(
    (data) => {
      if (data.toType === "monitor") {
        return Boolean(data.dependencyMonitorId);
      }
      return Boolean(data.dependencyExternalServiceId);
    },
    {
      message:
        "dependencyMonitorId is required for monitor targets; dependencyExternalServiceId is required for external service targets",
      path: ["dependencyMonitorId"],
    },
  )
  .refine(
    (data) => {
      if (
        data.toType === "monitor" &&
        data.dependentMonitorId &&
        data.dependencyMonitorId
      ) {
        return (
          data.dependentMonitorId.toString() !==
          data.dependencyMonitorId.toString()
        );
      }
      return true;
    },
    {
      message: "A monitor cannot depend on itself (self-dependency rejected)",
      path: ["dependencyMonitorId"],
    },
  );

export const updateDependencySchema = z.object({
  dependencyType: z.enum(DEPENDENCY_TYPE_VALUES).optional(),
  description: descriptionField.optional(),
  isActive: z.boolean().optional(),
});

export const listDependenciesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  monitorId: optionalObjectIdSchema,
  dependentMonitorId: optionalObjectIdSchema,
  dependencyMonitorId: optionalObjectIdSchema,
  dependencyType: z.enum(DEPENDENCY_TYPE_VALUES).optional(),
  isActive: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .or(z.boolean())
    .optional(),
  sortBy: z.enum(DEPENDENCY_SORT_FIELDS).default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

export const getGraphQuerySchema = z.object({
  connectedOnly: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .or(z.boolean())
    .default(false),
  includeExternal: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .or(z.boolean())
    .default(true),
  activeOnly: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .or(z.boolean())
    .default(false),
});

export const validateDependencySchema = createDependencySchema;
