import { z } from "zod";

const nameField = z
  .string({ required_error: "Name is required" })
  .trim()
  .min(2, "Name must be at least 2 characters")
  .max(120, "Name cannot exceed 120 characters");

const emailField = z
  .string({ required_error: "Email is required" })
  .trim()
  .toLowerCase()
  .email("Enter a valid email address");

// Mirrors the client-side strength checks (PasswordStrengthMeter) so the
// same rules are enforced whether or not the browser's JS validation ran.
const registerPasswordField = z
  .string({ required_error: "Password is required" })
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Include at least one uppercase letter")
  .regex(/[0-9]/, "Include at least one number")
  .regex(/[^A-Za-z0-9]/, "Include at least one special character");

const rememberMeField = z.boolean().optional();

export const registerSchema = z
  .object({
    name: nameField,
    email: emailField,
    password: registerPasswordField,
    confirmPassword: z.string({
      required_error: "Please confirm your password",
    }),

    rememberMe: rememberMeField.default(true),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email: emailField,
  password: z
    .string({ required_error: "Password is required" })
    .min(1, "Password is required"),

  rememberMe: rememberMeField.default(false),
});
