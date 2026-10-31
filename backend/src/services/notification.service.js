import Notification from "../models/Notification.js";
import UserPreference from "../models/UserPreference.js";
import User from "../models/User.js";
import {
  sendNotificationEmail,
  sendNotificationDigestEmail,
} from "./email.service.js";
import ApiError from "../utils/ApiError.js";
import logger from "../utils/logger.js";
import {
  NOTIFICATION_TYPE_CATEGORY,
  NOTIFICATION_PRIORITIES,
  NOTIFICATION_STATUS_FILTER_UNREAD,
  NOTIFICATION_STATUS_FILTER_READ,
} from "../config/notificationConstants.js";

const alertPreferenceKey = (type) => {
  if (type === "monitor_down" || type === "monitor_degraded")
    return "monitorDown";
  if (type === "monitor_up") return "monitorRecovery";
  if (["performance_degraded", "performance_recovered"].includes(type))
    return "performanceAlerts";
  if (
    [
      "ssl_expiring_soon",
      "ssl_expired",
      "ssl_invalid",
      "domain_expiring_soon",
      "domain_expired",
    ].includes(type)
  )
    return "sslExpiry";
  if (["incident_opened", "incident_resolved"].includes(type))
    return "incidents";
  if (
    [
      "plan_upgraded",
      "plan_downgraded",
      "plan_upgrade_request_submitted",
      "plan_upgrade_request_approved",
      "plan_upgrade_request_rejected",
      "usage_limit_reached",
    ].includes(type)
  )
    return "billing";
  if (type === "account_security") return "accountSecurity";
  return "systemAnnouncements";
};
const emailPreferenceKey = (type) =>
  [
    "monitorDown",
    "monitorRecovery",
    "performanceAlerts",
    "sslExpiry",
    "incidents",
  ].includes(alertPreferenceKey(type))
    ? alertPreferenceKey(type)
    : null;

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
const dispatchChannels = async (notification, preferences, user) => {
  notification.channels.inApp = {
    sent: preferences.inApp[alertPreferenceKey(notification.type)] !== false,
    sentAt:
      preferences.inApp[alertPreferenceKey(notification.type)] !== false
        ? new Date()
        : null,
    error: null,
  };

  await dispatchPushChannel(notification);

  await notification.save();
  // SMTP latency must not hold up monitor checks or notification API work.
  void dispatchEmailChannel(notification, preferences, user);
};

// eslint-disable-next-line no-unused-vars
const dispatchEmailChannel = async (notification, preferences, user) => {
  const key = emailPreferenceKey(notification.type);
  if (
    !preferences.email.enabled ||
    !key ||
    preferences.email[key] === false ||
    preferences.frequency !== "immediate"
  )
    return;
  try {
    await sendNotificationEmail(user, notification);
    await Notification.updateOne(
      { _id: notification._id },
      {
        $set: {
          "channels.email.sent": true,
          "channels.email.sentAt": new Date(),
          "channels.email.error": null,
        },
      },
    );
  } catch (error) {
    await Notification.updateOne(
      { _id: notification._id },
      { $set: { "channels.email.error": error.message } },
    );
    logger.warn(
      `Notification email failed for ${user.email}: ${error.message}`,
    );
  }
};

// eslint-disable-next-line no-unused-vars
const dispatchPushChannel = async (notification) => {
  // Not yet implemented — see the dispatchChannels comment above.
};

// ── Create ───────────────────────────────────────────────────────────────────

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
    const prefsDoc = await UserPreference.getOrCreateForUser(ownerId);
    const preferences = prefsDoc.notifications.toObject();
    const inAppEnabled = preferences.inApp[alertPreferenceKey(type)] !== false;
    const emailKey = emailPreferenceKey(type);
    const emailEnabled =
      preferences.email.enabled &&
      emailKey &&
      preferences.email[emailKey] !== false;
    if (!inAppEnabled && !emailEnabled) return null;
    const needsImmediateEmail =
      emailEnabled && preferences.frequency === "immediate";
    const user = needsImmediateEmail
      ? await User.findById(ownerId).select("name email")
      : null;
    if (needsImmediateEmail && !user) return null;
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

    await dispatchChannels(notification, preferences, user);

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
  const filter = { owner: ownerId, "channels.inApp.sent": true };

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
 * per-category counts in the page's filter bar. Backed by
 * Notification.getUnreadSummary, a single $facet aggregation, rather than
 * two separate queries (a count + a group-by).
 */
export const getUnreadSummary = async (user) => {
  const ownerId = resolveOwnerId(user);
  return Notification.getUnreadSummary(ownerId);
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
  const result = await Notification.deleteMany({
    owner: ownerId,
    read: true,
    "channels.inApp.sent": true,
  });
  return result.deletedCount;
};

export const dispatchNotificationDigests = async () => {
  const prefsList = await UserPreference.find({
    "notifications.email.enabled": true,
    "notifications.frequency": { $in: ["daily", "weekly"] },
  })
    .select("user notifications")
    .lean();
  const eligibleTypes = [
    "monitor_down",
    "monitor_up",
    "monitor_degraded",
    "incident_opened",
    "incident_resolved",
    "performance_degraded",
    "performance_recovered",
    "ssl_expiring_soon",
    "ssl_expired",
    "ssl_invalid",
    "domain_expiring_soon",
    "domain_expired",
  ];
  for (const prefs of prefsList) {
    const frequency = prefs.notifications.frequency;
    const age = (frequency === "daily" ? 1 : 7) * 24 * 60 * 60 * 1000;
    const types = eligibleTypes.filter((type) => {
      const key = emailPreferenceKey(type);
      return key && prefs.notifications.email[key] !== false;
    });
    if (!types.length) continue;
    const pending = await Notification.find({
      owner: prefs.user,
      type: { $in: types },
      createdAt: { $lte: new Date(Date.now() - age) },
      ...(prefs.notifications.email.enabledAt
        ? {
            createdAt: {
              $gte: prefs.notifications.email.enabledAt,
              $lte: new Date(Date.now() - age),
            },
          }
        : {}),
      "channels.email.sent": false,
    })
      .sort({ createdAt: 1 })
      .limit(100);
    if (!pending.length) continue;
    const user = await User.findById(prefs.user).select("name email");
    if (!user) continue;
    try {
      await sendNotificationDigestEmail(user, pending, frequency);
      await Notification.updateMany(
        { _id: { $in: pending.map((item) => item._id) } },
        {
          $set: {
            "channels.email.sent": true,
            "channels.email.sentAt": new Date(),
            "channels.email.error": null,
          },
        },
      );
    } catch (error) {
      await Notification.updateMany(
        { _id: { $in: pending.map((item) => item._id) } },
        { $set: { "channels.email.error": error.message } },
      );
      logger.warn(
        `Notification digest failed for ${user.email}: ${error.message}`,
      );
    }
  }
};
