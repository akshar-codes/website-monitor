import { z } from "zod";

const price = z.object({ monthly: z.number().finite().min(0).max(10000000), yearly: z.number().finite().min(0).max(10000000) }).strict();
export const updateBillingSettingsSchema = z.object({
  mode: z.enum(["request", "payment"]),
  currency: z.enum(["USD", "INR"]),
  prices: z.object({ free: price, pro: price, unlimited: price }).strict(),
}).strict();
