import { z } from "zod";

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(60)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use lowercase letters, numbers, and single hyphens",
  );
const reserved = new Set([
  "api",
  "admin",
  "login",
  "register",
  "status",
  "settings",
  "dashboard",
  "monitors",
]);
const slugField = slug.refine(
  (value) => !reserved.has(value),
  "This slug is reserved",
);
const fields = {
  name: z.string().trim().min(1).max(120),
  slug: slugField,
  description: z.string().trim().max(500).optional(),
  logo: z.string().trim().max(500).url().or(z.literal("")).optional(),
  timezone: z.string().trim().min(1).max(80).optional(),
};
export const createStatusPageSchema = z
  .object({
    name: fields.name,
    slug: fields.slug,
    description: fields.description,
    logo: fields.logo,
    timezone: fields.timezone,
  })
  .strict();
export const updateStatusPageSchema = z
  .object(fields)
  .partial()
  .strict()
  .refine(
    (data) => Object.keys(data).length > 0,
    "At least one field is required",
  );
export const serviceSchema = z
  .object({
    monitorId: z.string().regex(/^[a-f\d]{24}$/i),
    displayName: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(500).optional(),
    isVisible: z.boolean().optional(),
  })
  .strict();
