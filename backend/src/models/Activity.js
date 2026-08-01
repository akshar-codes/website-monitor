import mongoose from "mongoose";
import {
  ACTIVITY_CATEGORY_VALUES,
  ACTIVITY_ACTION_VALUES,
} from "../config/activityConstants.js";

const activitySchema = new mongoose.Schema(
  {
    // Owner-scoped like Monitor/Incident — every query in
    // services/activity.service.js filters on this first.
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Activity user reference is required"],
      index: true,
    },

    category: {
      type: String,
      required: [true, "Activity category is required"],
      enum: {
        values: ACTIVITY_CATEGORY_VALUES,
        message: `Category must be one of: ${ACTIVITY_CATEGORY_VALUES.join(", ")}`,
      },
    },

    action: {
      type: String,
      required: [true, "Activity action is required"],
      enum: {
        values: ACTIVITY_ACTION_VALUES,
        message: `Action must be one of: ${ACTIVITY_ACTION_VALUES.join(", ")}`,
      },
    },

    // Human-readable, pre-rendered at write time (e.g. `Created monitor
    // "Prod API"`) — the timeline renders this directly rather than
    // reconstructing sentences client-side from category/action/metadata.
    description: {
      type: String,
      required: [true, "Activity description is required"],
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },

    // Optional reference to the resource this activity concerns (e.g.
    // "Monitor" / monitorId) — generic rather than a per-type field so
    // new entity types never require a schema change.
    entityType: {
      type: String,
      trim: true,
      default: null,
    },

    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    // Small structured payload for context the description doesn't carry
    // verbatim (e.g. { from: "free", to: "pro" }). Never used to store
    // secrets or PII beyond what's already on the user/entity in
    // question — every write site is internal/trusted (see
    // utils/activityLogger.js), never populated from raw client input.
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    ip: {
      type: String,
      default: null,
    },

    userAgent: {
      type: String,
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
// Indexes — tuned for the exact query patterns in activity.service.js
// ─────────────────────────────────────────────

// Base timeline: "my activity, newest first" (every list call filters on
// `user` and sorts by `createdAt desc`, with or without other filters).
activitySchema.index({ user: 1, createdAt: -1 });

// Category filter (e.g. "just monitor activity").
activitySchema.index({ user: 1, category: 1, createdAt: -1 });

// Action filter (e.g. "just logins").
activitySchema.index({ user: 1, action: 1, createdAt: -1 });

// Entity lookup ("history for this specific monitor/incident/etc.") —
// not yet exposed via a route, kept ready the same way
// middlewares/ownership.js is kept ready ahead of its first caller.
activitySchema.index({ user: 1, entityType: 1, entityId: 1 });

const Activity = mongoose.model("Activity", activitySchema);

export default Activity;
