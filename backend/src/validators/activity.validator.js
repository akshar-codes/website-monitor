import { z } from "zod";
import {
  ACTIVITY_CATEGORY_VALUES,
  ACTIVITY_ACTION_VALUES,
} from "../config/activityConstants.js";
import { WINDOW_KEYS } from "../config/constants.js";

const WINDOW_FILTER_VALUES = [...WINDOW_KEYS, "all"];

export const listActivitySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  category: z.enum(ACTIVITY_CATEGORY_VALUES).optional(),
  action: z.enum(ACTIVITY_ACTION_VALUES).optional(),
  search: z
    .string()
    .trim()
    .max(200, "Search term cannot exceed 200 characters")
    .optional(),
  window: z.enum(WINDOW_FILTER_VALUES).optional().default("all"),
});

export const activitySummaryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
});
