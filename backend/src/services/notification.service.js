import Notification from "../models/Notification.js";
import ApiError from "../utils/ApiError.js";
import logger from "../utils/logger.js";
import {
  NOTIFICATION_TYPE_CATEGORY,
  NOTIFICATION_PRIORITIES,
  NOTIFICATION_STATUS_FILTER_UNREAD,
  NOTIFICATION_STATUS_FILTER_READ,
} from "../config/notificationConstants.js";

const resolveOwnerId = (user) => user.id || user._id.toString();

// ── Dispatch (in-app now; email/push are future extension points) ──────────

/**
 * In-app delivery is "complete" the moment the document exists — the
 * frontend polls/fetches it directly — so this just timestamps the
 * channel. `dispatchEmailChannel` / `dispatchPushChannel` are intentional
 * no-ops today.
 *
 * When email is wired up: check the recipient's notification preferences
 * (once that concept exists on UserPreference), render a template the
 * same way utils/email/templates/*.js already does, send it via
 * services/email.service.js, and set channels.email accordingly. Push
 * follows the same shape against a push provider (web push / FCM). Either
 * addition is a change to exactly one function here — every notification
 * document already carries all three channel slots (see
 * models/Notification.js), so nothing else in the create/read/update path
 * needs to change.
 */
const dispatchChannels = async (notification) => {
  notification.channels.inApp = {
    sent: true,
    sentAt: new Date(),
    error: null,
  };

  await dispatchEmailChannel(notification);
  await dispatchPushChannel(notification);

  await notification.save();
};

// eslint-disable-next-line no-unused-vars
const dispatchEmailChannel = async (notification) => {
  // Not yet implemented — see the dispatchChannels comment above.
};

// eslint-disable-next-line no-unused-vars
const dispatchPushChannel = async (notification) => {
  // Not yet implemented — see the dispatchChannels comment above.
};

// ── Create ───────────────────────────────────────────────────────────────────

/**
 * Creates and persists a notification for a single user. This is the one
 * reusable entry point every domain service should call to notify a user
 * of something happening (an incident opening, a plan change, a usage
 * limit being hit, ...) — see workers/incidentManager.js for the
 * reference integration. Callers never construct a Notification document
 * directly, so category derivation and channel dispatch always happen
 * consistently regardless of the trigger.
 *
 * Never throws — a failure to create/dispatch a notification must not
 * fail the business operation that triggered it (an incident still opens
 * even if notifying the owner about it fails); the error is logged and
 * `null` is returned instead.
 */
export const createNotification = async ({
  ownerId,
  type,
  title,
  message,
  priority = NOTIFICATION_PRIORITIES.NORMAL,
  link = null,
  relatedResource = null,
  metadata = null,
  expiresAt = null,
}) => {
  if (!NOTIFICATION_TYPE_CATEGORY[type]) {
    logger.error(`Refusing to create notification with unknown type: ${type}`);
    return null;
  }

  try {
    const notification = await Notification.create({
      owner: ownerId,
      type,
      category: NOTIFICATION_TYPE_CATEGORY[type],
      priority,
      title,
      message,
      link,
      relatedResource: relatedResource
        ? {
            resourceType: relatedResource.resourceType,
            resourceId: relatedResource.resourceId,
          }
        : undefined,
      metadata,
      expiresAt,
    });

    await dispatchChannels(notification);

    return notification;
  } catch (error) {
    logger.error(
      `Failed to create notification (type "${type}") for user ${ownerId}: ${error.message}`,
      { stack: error.stack },
    );
    return null;
  }
};

/**
 * Fan-out helper for notifying multiple users at once (e.g. a future
 * "notify every team member" or "notify every admin" use case).
 * Promise.allSettled so one recipient's failure never blocks the rest —
 * returns how many notifications were actually created.
 */
export const createNotificationForUsers = async (ownerIds, payload) => {
  const results = await Promise.allSettled(
    ownerIds.map((ownerId) => createNotification({ ...payload, ownerId })),
  );
  return results.filter((r) => r.status === "fulfilled" && r.value).length;
};

// ── Read ─────────────────────────────────────────────────────────────────────

export const getNotifications = async (
  user,
  { page, limit, category, status },
) => {
  const ownerId = resolveOwnerId(user);
  const filter = { owner: ownerId };

  if (category) filter.category = category;
  if (status === NOTIFICATION_STATUS_FILTER_UNREAD) filter.read = false;
  if (status === NOTIFICATION_STATUS_FILTER_READ) filter.read = true;

  const skip = (page - 1) * limit;

  const [notifications, total] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Notification.countDocuments(filter),
  ]);

  return {
    notifications,
    total,
    page,
    totalPages: Math.ceil(total / limit) || 1,
  };
};

/**
 * Total unread + per-category breakdown — powers the bell badge and the
 * per-category counts in the page's filter bar in two indexed queries
 * regardless of how many notifications the user has.
 */
export const getUnreadSummary = async (user) => {
  const ownerId = resolveOwnerId(user);

  const [total, byCategory] = await Promise.all([
    Notification.countUnreadForUser(ownerId),
    Notification.unreadCountsByCategory(ownerId),
  ]);

  return { total, byCategory };
};

// ── Update ───────────────────────────────────────────────────────────────────

export const markAsRead = async (user, id) => {
  const ownerId = resolveOwnerId(user);

  const notification = await Notification.findOneAndUpdate(
    { _id: id, owner: ownerId, read: false },
    { $set: { read: true, readAt: new Date() } },
    { returnDocument: "after" },
  );

  if (notification) return notification;

  // Either it doesn't exist/isn't owned by this user, or it was already
  // read — distinguish the two so re-clicking an already-read item (e.g.
  // a stale dropdown) doesn't surface as a 404.
  const existing = await Notification.findOne({ _id: id, owner: ownerId });
  if (!existing) {
    throw ApiError.notFound(`Notification not found with id: ${id}`);
  }
  return existing;
};

export const markAllAsRead = async (user, { category } = {}) => {
  const ownerId = resolveOwnerId(user);
  const filter = { owner: ownerId, read: false };
  if (category) filter.category = category;

  const result = await Notification.updateMany(filter, {
    $set: { read: true, readAt: new Date() },
  });

  return result.modifiedCount;
};

// ── Delete ───────────────────────────────────────────────────────────────────

export const deleteNotification = async (user, id) => {
  const ownerId = resolveOwnerId(user);

  const notification = await Notification.findOneAndDelete({
    _id: id,
    owner: ownerId,
  });
  if (!notification) {
    throw ApiError.notFound(`Notification not found with id: ${id}`);
  }
  return notification;
};

/**
 * Bulk-deletes every already-read notification for the user — the "clear
 * read notifications" action on the notifications page. Unread
 * notifications are never touched, so nothing can be silently dismissed
 * without the user having seen it first.
 */
export const clearReadNotifications = async (user) => {
  const ownerId = resolveOwnerId(user);
  const result = await Notification.deleteMany({ owner: ownerId, read: true });
  return result.deletedCount;
};
