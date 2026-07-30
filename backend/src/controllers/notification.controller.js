import asyncHandler from "../utils/asyncHandler.js";
import * as notificationService from "../services/notification.service.js";
import { sendSuccess, sendPaginated } from "../utils/apiResponse.js";

// ── Controllers ──────────────────────────────────────────────────────────────

/**
 * GET /api/notifications
 * Paginated feed, optionally filtered by category and/or read status.
 */
export const getNotifications = asyncHandler(async (req, res) => {
  const query = req.validatedQuery;
  const result = await notificationService.getNotifications(req.user, query);

  sendPaginated(res, {
    data: result.notifications,
    page: result.page,
    limit: query.limit,
    total: result.total,
  });
});

/**
 * GET /api/notifications/unread-count
 * Powers the bell badge — total unread plus a per-category breakdown.
 */
export const getUnreadSummary = asyncHandler(async (req, res) => {
  const data = await notificationService.getUnreadSummary(req.user);

  sendSuccess(res, { data });
});

/**
 * PATCH /api/notifications/:id/read
 */
export const markAsRead = asyncHandler(async (req, res) => {
  const notification = await notificationService.markAsRead(
    req.user,
    req.params.id,
  );

  sendSuccess(res, {
    message: "Notification marked as read",
    data: notification,
  });
});

/**
 * POST /api/notifications/mark-all-read
 * Optionally scoped to a single category via the request body.
 */
export const markAllAsRead = asyncHandler(async (req, res) => {
  const count = await notificationService.markAllAsRead(req.user, req.body);

  sendSuccess(res, {
    message:
      count > 0
        ? `${count} notification${count === 1 ? "" : "s"} marked as read`
        : "No unread notifications to update",
    data: { count },
  });
});

/**
 * DELETE /api/notifications/:id
 */
export const deleteNotification = asyncHandler(async (req, res) => {
  await notificationService.deleteNotification(req.user, req.params.id);

  sendSuccess(res, { message: "Notification deleted successfully" });
});

/**
 * DELETE /api/notifications/read
 * Bulk-clears every already-read notification for the caller.
 */
export const clearReadNotifications = asyncHandler(async (req, res) => {
  const count = await notificationService.clearReadNotifications(req.user);

  sendSuccess(res, {
    message:
      count > 0
        ? `Cleared ${count} read notification${count === 1 ? "" : "s"}`
        : "No read notifications to clear",
    data: { count },
  });
});
