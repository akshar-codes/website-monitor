import { z } from "zod";
import { EXTERNAL_SERVICE_TYPE_VALUES } from "../config/constants.js";

const nameField = z
  .string({ required_error: "Service name is required" })
  .trim()
  .min(1, "Service name cannot be empty")
  .max(120, "Service name cannot exceed 120 characters");

const typeField = z.enum(EXTERNAL_SERVICE_TYPE_VALUES, {
  errorMap: () => ({
    message: `Type must be one of: ${EXTERNAL_SERVICE_TYPE_VALUES.join(", ")}`,
  }),
});

const descriptionField = z
  .string()
  .trim()
  .max(500, "Description cannot exceed 500 characters")
  .optional()
  .default("");

const hostField = z
  .string()
  .trim()
  .max(255, "Host cannot exceed 255 characters")
  .nullable()
  .optional();

export const createExternalServiceSchema = z.object({
  name: nameField,
  type: typeField.default("other"),
  description: descriptionField,
  host: hostField,
});

export const updateExternalServiceSchema = z.object({
  name: nameField.optional(),
  type: typeField.optional(),
  description: descriptionField.optional(),
  host: hostField.optional(),
  status: z.enum(["healthy", "degraded", "unhealthy", "unknown"]).optional(),
  isActive: z.boolean().optional(),
});
