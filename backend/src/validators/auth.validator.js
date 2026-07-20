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

const strongPasswordField = z
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
    password: strongPasswordField,
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

// ── Email verification ──

export const verifyEmailSchema = z.object({
  token: z
    .string({ required_error: "Verification token is required" })
    .trim()
    .min(1, "Verification token is required"),
});

export const resendVerificationSchema = z.object({
  email: emailField,
});

// ── Password reset ──

export const forgotPasswordSchema = z.object({
  email: emailField,
});

export const resetPasswordSchema = z
  .object({
    token: z
      .string({ required_error: "Reset token is required" })
      .trim()
      .min(1, "Reset token is required"),
    password: strongPasswordField,
    confirmPassword: z.string({
      required_error: "Please confirm your password",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
