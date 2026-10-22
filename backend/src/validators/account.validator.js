import { z } from "zod";

export const deleteAccountSchema = z.object({
  confirmationEmail: z
    .string()
    .trim()
    .email("Enter your account email to confirm deletion"),
});
