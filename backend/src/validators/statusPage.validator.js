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
  logo: z
    .string()
    .trim()
    .max(500)
    .url()
    .or(z.literal(""))
    .refine(
      (value) =>
        !value || ["http:", "https:"].includes(new URL(value).protocol),
      "Logo must use HTTP or HTTPS",
    )
    .optional(),
  timezone: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .refine((value) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: value });
        return true;
      } catch {
        return false;
      }
    }, "Use a valid IANA timezone")
    .optional(),
  branding: z
    .object({
      theme: z.enum(["light", "dark"]).optional(),
      accentColor: z
        .string()
        .regex(/^#[0-9a-fA-F]{6}$/)
        .optional(),
    })
    .strict()
    .optional(),
};
export const createStatusPageSchema = z
  .object({
    name: fields.name,
    slug: fields.slug,
    description: fields.description,
    logo: fields.logo,
    timezone: fields.timezone,
    branding: fields.branding,
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

const serviceIdList = z.array(z.string().regex(/^[a-f\d]{24}$/i)).max(100);
export const reorderServicesSchema = z
  .object({ serviceIds: serviceIdList })
  .strict();
export const incidentCreateSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    description: z.string().trim().max(3000).optional(),
    severity: z.enum(["minor", "major", "critical"]).optional(),
    affectedServices: serviceIdList.optional(),
  })
  .strict();
export const incidentUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(160).optional(),
    description: z.string().trim().max(3000).optional(),
    severity: z.enum(["minor", "major", "critical"]).optional(),
    affectedServices: serviceIdList.optional(),
  })
  .strict()
  .refine(
    (data) => Object.keys(data).length > 0,
    "At least one field is required",
  );
export const incidentTimelineSchema = z
  .object({
    message: z.string().trim().min(1).max(3000),
    status: z.enum(["investigating", "identified", "monitoring"]).optional(),
  })
  .strict();
export const resolveIncidentSchema = z
  .object({ message: z.string().trim().max(3000).optional() })
  .strict();
const dateField = z.coerce.date();
export const maintenanceCreateSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    description: z.string().trim().max(3000).optional(),
    affectedServices: serviceIdList.optional(),
    scheduledStart: dateField,
    scheduledEnd: dateField,
    isPublished: z.boolean().optional(),
  })
  .strict()
  .refine((data) => data.scheduledEnd > data.scheduledStart, {
    message: "End time must be after start time",
    path: ["scheduledEnd"],
  });
export const maintenanceUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(160).optional(),
    description: z.string().trim().max(3000).optional(),
    affectedServices: serviceIdList.optional(),
    scheduledStart: dateField.optional(),
    scheduledEnd: dateField.optional(),
    status: z
      .enum(["scheduled", "in_progress", "completed", "cancelled"])
      .optional(),
    isPublished: z.boolean().optional(),
  })
  .strict()
  .refine(
    (data) => Object.keys(data).length > 0,
    "At least one field is required",
  );
export const subscriptionSchema = z
  .object({
    email: z.string().trim().email().max(254),
    preferences: z
      .object({
        incidents: z.boolean().optional(),
        incidentUpdates: z.boolean().optional(),
        maintenance: z.boolean().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();
export const tokenSchema = z
  .object({ token: z.string().min(20).max(500) })
  .strict();
export const updatePreferencesSchema = z
  .object({
    token: z.string().min(20).max(500),
    preferences: z
      .object({
        incidents: z.boolean().optional(),
        incidentUpdates: z.boolean().optional(),
        maintenance: z.boolean().optional(),
      })
      .strict(),
  })
  .strict();
export const uptimeRangeSchema = z
  .object({
    window: z.enum(["24h", "7d", "30d", "90d"]).optional().default("90d"),
  })
  .strict();
