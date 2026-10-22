import { z } from "zod";

export const createApiKeySchema = z.object({
  name: z.string().trim().min(2).max(60),
  expiresInDays: z
    .union([z.literal(30), z.literal(90), z.literal(180), z.literal(365)])
    .nullable()
    .default(null),
});
