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
    dedupeKey: { type: String, default: null },
    alertingProcessedAt: { type: Date, default: null, select: false },

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

    channels: {
      inApp: { type: channelStateSchema, default: () => ({}) },
      email: { type: channelStateSchema, default: () => ({}) },
      push: { type: channelStateSchema, default: () => ({}) },
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

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
notificationSchema.index({ type: 1, alertingProcessedAt: 1, createdAt: 1 });
notificationSchema.index({ type: 1, alertingProcessedAt: 1, createdAt: 1 });

// Unread badge count / unread-only feed.
notificationSchema.index({ owner: 1, read: 1, createdAt: -1 });

// Category-filtered feed.
notificationSchema.index({ owner: 1, category: 1, createdAt: -1 });

// Category + read-state combined filter (page's default view + per-category
// unread badges).
notificationSchema.index({ owner: 1, category: 1, read: 1, createdAt: -1 });

// Pending email digests are selected per owner and delivery state, oldest first.
notificationSchema.index({ owner: 1, "channels.email.sent": 1, createdAt: 1 });
notificationSchema.index(
  { dedupeKey: 1 },
  { unique: true, partialFilterExpression: { dedupeKey: { $type: "string" } } },
);

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
  return this.countDocuments({
    owner: ownerId,
    read: false,
    "channels.inApp.sent": true,
  });
};

/**
 * Total unread count + per-category breakdown in a SINGLE aggregation call
 * (via $facet) rather than two separate queries — powers the bell badge and
 * the per-category counts in the notifications page's filter bar.
 */
notificationSchema.statics.getUnreadSummary = async function (ownerId) {
  const [result] = await this.aggregate([
    {
      $match: {
        owner: new mongoose.Types.ObjectId(ownerId),
        read: false,
        "channels.inApp.sent": true,
      },
    },
    {
      $facet: {
        total: [{ $count: "count" }],
        byCategory: [{ $group: { _id: "$category", count: { $sum: 1 } } }],
      },
    },
  ]);

  const total = result?.total?.[0]?.count || 0;
  const byCategory = (result?.byCategory || []).reduce(
    (acc, { _id, count }) => {
      acc[_id] = count;
      return acc;
    },
    {},
  );

  return { total, byCategory };
};

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;
