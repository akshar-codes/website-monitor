import mongoose from "mongoose";
import {
  ACTIVITY_CATEGORY_VALUES,
  ACTIVITY_ACTION_VALUES,
} from "../config/activityConstants.js";

const activitySchema = new mongoose.Schema(
  {
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

    description: {
      type: String,
      required: [true, "Activity description is required"],
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },

    outcome: { type: String, enum: ["success", "failure"], default: "success", index: true },

    entityType: {
      type: String,
      trim: true,
      default: null,
    },

    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

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
activitySchema.index({ category: 1, createdAt: -1 });
activitySchema.index({ category: 1, action: 1, createdAt: -1 });
activitySchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
activitySchema.index({ entityId: 1, createdAt: -1 });

// Category filter (e.g. "just monitor activity").
activitySchema.index({ user: 1, category: 1, createdAt: -1 });

// Action filter (e.g. "just logins").
activitySchema.index({ user: 1, action: 1, createdAt: -1 });

// Entity lookup ("history for this specific monitor/incident/etc.") —
// not yet exposed via a route, kept ready the same way
// middlewares/ownership.js is kept ready ahead of its first caller.
activitySchema.index({ user: 1, entityType: 1, entityId: 1 });

// ─────────────────────────────────────────────
// Statics
// ─────────────────────────────────────────────

activitySchema.statics.getCategorySummary = async function (ownerId, since) {
  const [result] = await this.aggregate([
    {
      $match: {
        user: new mongoose.Types.ObjectId(ownerId),
        createdAt: { $gte: since },
      },
    },
    {
      $facet: {
        byCategory: [
          { $group: { _id: "$category", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ],
        total: [{ $count: "count" }],
      },
    },
  ]);

  return {
    byCategory: (result?.byCategory || []).map((c) => ({
      category: c._id,
      count: c.count,
    })),
    total: result?.total?.[0]?.count || 0,
  };
};

const Activity = mongoose.model("Activity", activitySchema);

export default Activity;
