import { z } from "zod";

export const correlationQuerySchema = z.object({
  lookbackMinutes: z.coerce
    .number()
    .int()
    .min(1)
    .max(1440)
    .optional()
    .default(30),
  lookaheadMinutes: z.coerce
    .number()
    .int()
    .min(0)
    .max(1440)
    .optional()
    .default(10),
});
