import { z } from "zod";

const nameField = z
  .string()
  .trim()
  .min(2, "Name must be at least 2 characters")
  .max(120, "Name cannot exceed 120 characters");

const bioField = z.string().trim().max(500, "Bio cannot exceed 500 characters");

const locationField = z
  .string()
  .trim()
  .max(120, "Location cannot exceed 120 characters");

const websiteField = z
  .string()
  .trim()
  .max(200, "Website URL cannot exceed 200 characters")
  .refine(
    (v) => {
      if (!v) return true; // empty string clears the field — see refine below
      try {
        return ["http:", "https:"].includes(new URL(v).protocol);
      } catch {
        return false;
      }
    },
    { message: "Website must be a valid HTTP or HTTPS URL" },
  );

const phoneField = z
  .string()
  .trim()
  .max(30, "Phone number cannot exceed 30 characters")
  .regex(/^[+]?[\d\s\-().]*$/, "Enter a valid phone number");

/**
 * Every field is optional at the top level — PUT /api/profile is a partial
 * update, mirroring updateMonitorSchema's pattern. Fields that ARE
 * provided may be an empty string, which is how the client clears an
 * optional field (bio/location/website/phone) rather than omitting it.
 */
export const updateProfileSchema = z
  .object({
    name: nameField.optional(),
    bio: bioField.optional(),
    location: locationField.optional(),
    website: websiteField.optional(),
    phone: phoneField.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update",
  });
