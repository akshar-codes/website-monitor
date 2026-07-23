import { z } from "zod";
import { PLAN_VALUES } from "../config/constants.js";

export const changePlanSchema = z.object({
  plan: z.enum(PLAN_VALUES, {
    required_error: "Plan is required",
    invalid_type_error: `Plan must be one of: ${PLAN_VALUES.join(", ")}`,
  }),
});
