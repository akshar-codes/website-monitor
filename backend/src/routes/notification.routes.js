/**
 * Notification routes
 *
 * GET    /api/notifications               — paginated feed (filter: category, status)
 * GET    /api/notifications/unread-count  — unread total + per-category breakdown (badge)
 * POST   /api/notifications/mark-all-read — mark all (optionally one category) as read
 * DELETE /api/notifications/read          — bulk-delete every already-read notification
 * PATCH  /api/notifications/:id/read      — mark a single notification as read
 * DELETE /api/notifications/:id           — delete a single notification
 *
 * Authentication is enforced once at the mount point (routes/index.js).
 * Every route additionally requires the relevant permission (see
 * config/permissions.js). DELETE "/read" is registered before DELETE
 * "/:id" so the literal path isn't swallowed by the :id param route.
 */

import { Router } from "express";
import {
  getNotifications,
  getUnreadSummary,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearReadNotifications,
} from "../controllers/notification.controller.js";
import { validate, validateObjectId } from "../middlewares/validate.js";
import { requirePermission } from "../middlewares/permission.js";
import {
  listNotificationsSchema,
  markAllReadSchema,
} from "../validators/notification.validator.js";

const router = Router();

router.get(
  "/",
  requirePermission("notification:read"),
  validate(listNotificationsSchema, "query"),
  getNotifications,
);

router.get(
  "/unread-count",
  requirePermission("notification:read"),
  getUnreadSummary,
);

router.post(
  "/mark-all-read",
  requirePermission("notification:update"),
  validate(markAllReadSchema, "body"),
  markAllAsRead,
);

router.delete(
  "/read",
  requirePermission("notification:delete"),
  clearReadNotifications,
);

router.patch(
  "/:id/read",
  requirePermission("notification:update"),
  validateObjectId("id"),
  markAsRead,
);

router.delete(
  "/:id",
  requirePermission("notification:delete"),
  validateObjectId("id"),
  deleteNotification,
);

export default router;
