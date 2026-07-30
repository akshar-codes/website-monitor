import { z } from "zod";
import {
  NOTIFICATION_CATEGORY_VALUES,
  NOTIFICATION_STATUS_FILTER_VALUES,
  NOTIFICATION_STATUS_FILTER_ALL,
} from "../config/notificationConstants.js";

// ── List notifications (paginated feed) ──

export const listNotificationsSchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  category: z.enum(NOTIFICATION_CATEGORY_VALUES).optional(),
  status: z
    .enum(NOTIFICATION_STATUS_FILTER_VALUES)
    .optional()
    .default(NOTIFICATION_STATUS_FILTER_ALL),
});

// ── Mark all as read (optionally scoped to one category) ──

export const markAllReadSchema = z.object({
  category: z.enum(NOTIFICATION_CATEGORY_VALUES).optional(),
});
