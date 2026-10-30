import { z } from "zod";
import { PLAN_VALUES } from "../config/constants.js";

export const createOrderSchema = z.object({ plan: z.enum(PLAN_VALUES), period: z.enum(["monthly", "yearly"]).default("monthly") });
export const verifyPaymentSchema = z.object({ orderId: z.string().min(1).max(100), paymentId: z.string().min(1).max(100), signature: z.string().regex(/^[a-f\d]{64}$/i) });
