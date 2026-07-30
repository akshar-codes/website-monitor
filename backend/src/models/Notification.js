import mongoose from "mongoose";
import {
  NOTIFICATION_TYPE_VALUES,
  NOTIFICATION_CATEGORY_VALUES,
  NOTIFICATION_PRIORITY_VALUES,
  NOTIFICATION_PRIORITIES,
  NOTIFICATION_TYPE_CATEGORY,
} from "../config/notificationConstants.js";

const channelStateSchema = new mongoose.Schema(
  {
    sent: { type: Boolean, default: false },
    sentAt: { type: Date, default: null },
    error: { type: String, default: null },
  },
  { _id: false },
);

const notificationSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Notification owner is required"],
      index: true,
    },

    type: {
      type: String,
      required: [true, "Notification type is required"],
      enum: {
        values: NOTIFICATION_TYPE_VALUES,
        message: `Type must be one of: ${NOTIFICATION_TYPE_VALUES.join(", ")}`,
      },
    },

    // Denormalized from `type` via NOTIFICATION_TYPE_CATEGORY (see the
    // pre-validate hook below and services/notification.service.js, which
    // sets it explicitly at creation) — stored redundantly so
    // category-filtered list/count queries hit a plain indexed equality
    // match instead of re-deriving it from `type` on every read.
    category: {
      type: String,
      required: [true, "Notification category is required"],
      enum: {
        values: NOTIFICATION_CATEGORY_VALUES,
        message: `Category must be one of: ${NOTIFICATION_CATEGORY_VALUES.join(", ")}`,
      },
    },

    priority: {
      type: String,
      enum: {
        values: NOTIFICATION_PRIORITY_VALUES,
        message: `Priority must be one of: ${NOTIFICATION_PRIORITY_VALUES.join(", ")}`,
      },
      default: NOTIFICATION_PRIORITIES.NORMAL,
    },

    title: {
      type: String,
      required: [true, "Notification title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },

    message: {
      type: String,
      required: [true, "Notification message is required"],
      trim: true,
      maxlength: [1000, "Message cannot exceed 1000 characters"],
    },

    // Optional frontend route the notification navigates to when clicked
    // (e.g. "/insights"). Deliberately restricted to a relative in-app
    // path — never an absolute/external URL — so a notification can never
    // be used to redirect a user off-site.
    link: {
      type: String,
      trim: true,
      maxlength: [300, "Link cannot exceed 300 characters"],
      validate: {
        validator(v) {
          return !v || v.startsWith("/");
        },
        message: 'Link must be a relative in-app path (starting with "/")',
      },
      default: null,
    },

    // Generic reference to the resource this notification is about (a
    // Monitor, an Incident, ...). Deliberately not a Mongoose `ref` to a
    // single model, since notifications span many source types — kept as
    // a plain (type, id) pair for future dedup/grouping rather than
    // populated directly.
    relatedResource: {
      resourceType: { type: String, default: null },
      resourceId: { type: mongoose.Schema.Types.ObjectId, default: null },
    },

    read: {
      type: Boolean,
      default: false,
    },

    readAt: {
      type: Date,
      default: null,
    },

    // Per-channel delivery state. Only `inApp` is actually dispatched
    // today (see services/notification.service.js#dispatchChannels) —
    // `email` and `push` exist on every document now so wiring up those
    // channels later only requires implementing their dispatch function
    // and flipping `sent`, never a schema migration or API change.
    channels: {
      inApp: { type: channelStateSchema, default: () => ({}) },
      email: { type: channelStateSchema, default: () => ({}) },
      push: { type: channelStateSchema, default: () => ({}) },
    },

    // Free-form structured payload for the specific notification type
    // (e.g. { monitorId, previousStatus, responseTime }) — kept out of
    // `message` so the frontend can eventually render richer UI for
    // specific types without parsing prose.
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    // Optional TTL. Most notification types don't set this — but
    // low-priority/system types can opt in (see createNotification's
    // `expiresAt` param) so the collection doesn't grow unbounded with
    // stale, already-read noise.
    expiresAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,

    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },

    toObject: { virtuals: true },
  },
);

// ─────────────────────────────────────────────
// Indexes — tuned for the dropdown (recent/unread) and the full page
// (paginated, optionally filtered by category and/or read status)
// ─────────────────────────────────────────────

// Main per-user feed, newest first.
notificationSchema.index({ owner: 1, createdAt: -1 });

// Unread badge count / unread-only feed.
notificationSchema.index({ owner: 1, read: 1, createdAt: -1 });

// Category-filtered feed.
notificationSchema.index({ owner: 1, category: 1, createdAt: -1 });

// Category + read-state combined filter (page's default view + per-category
// unread badges).
notificationSchema.index({ owner: 1, category: 1, read: 1, createdAt: -1 });

// TTL cleanup — only applies to documents that opted into an expiry.
notificationSchema.index(
  { expiresAt: 1 },
  {
    expireAfterSeconds: 0,
    partialFilterExpression: { expiresAt: { $type: "date" } },
  },
);

// ─────────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────────

// Defense-in-depth: services/notification.service.js#createNotification
// already sets `category` explicitly from NOTIFICATION_TYPE_CATEGORY, but
// this guarantees a document can never be persisted with a `type` and a
// missing/mismatched `category`, regardless of call site.
notificationSchema.pre("validate", function deriveCategory() {
  if (this.type && !this.category) {
    this.category = NOTIFICATION_TYPE_CATEGORY[this.type];
  }
});

// ─────────────────────────────────────────────
// Statics
// ─────────────────────────────────────────────

notificationSchema.statics.countUnreadForUser = function (ownerId) {
  return this.countDocuments({ owner: ownerId, read: false });
};

/**
 * Unread count broken down by category — powers per-category badges on
 * the notifications page's filter bar via a single aggregation instead of
 * one countDocuments() per category.
 */
notificationSchema.statics.unreadCountsByCategory = async function (ownerId) {
  const results = await this.aggregate([
    {
      $match: {
        owner: new mongoose.Types.ObjectId(ownerId),
        read: false,
      },
    },
    { $group: { _id: "$category", count: { $sum: 1 } } },
  ]);

  return results.reduce((acc, { _id, count }) => {
    acc[_id] = count;
    return acc;
  }, {});
};

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;
