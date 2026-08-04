import mongoose from "mongoose";
import {
  PLAN_VALUES,
  PLAN_UPGRADE_REQUEST_STATUS,
  PLAN_UPGRADE_REQUEST_STATUS_VALUES,
} from "../config/constants.js";

/**
 * A manual plan-upgrade request. There is no payment gateway wired up yet
 * (see User.billing in models/User.js), so upgrades cannot be applied
 * automatically the way downgrades are (POST /api/plans/change remains
 * instant for downgrades) — a user submits a request here, and an admin
 * reviews it via the /admin/plan-upgrade-requests endpoints
 * (services/planUpgradeRequest.service.js), which apply the plan change
 * through the existing plan.service.js#changeUserPlan on approval.
 */
const planUpgradeRequestSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required"],
      index: true,
    },

    // Snapshot of the plan the user was on at request time — kept even
    // after approval/rejection so the admin queue and the user's own
    // history always show what the request actually represented,
    // regardless of any later plan changes.
    currentPlan: {
      type: String,
      required: [true, "Current plan snapshot is required"],
      enum: {
        values: PLAN_VALUES,
        message: `Current plan must be one of: ${PLAN_VALUES.join(", ")}`,
      },
    },

    requestedPlan: {
      type: String,
      required: [true, "Requested plan is required"],
      enum: {
        values: PLAN_VALUES,
        message: `Requested plan must be one of: ${PLAN_VALUES.join(", ")}`,
      },
    },

    status: {
      type: String,
      required: [true, "Status is required"],
      enum: {
        values: PLAN_UPGRADE_REQUEST_STATUS_VALUES,
        message: `Status must be one of: ${PLAN_UPGRADE_REQUEST_STATUS_VALUES.join(", ")}`,
      },
      default: PLAN_UPGRADE_REQUEST_STATUS.PENDING,
      index: true,
    },

    // ── Review metadata — set once an admin approves/rejects ──

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    reviewedAt: {
      type: Date,
      default: null,
    },

    rejectionReason: {
      type: String,
      trim: true,
      maxlength: [500, "Rejection reason cannot exceed 500 characters"],
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
// Indexes
// ─────────────────────────────────────────────

// A user's own request history, newest first, and the fast "do I already
// have a pending request" lookup used before allowing a new submission.
planUpgradeRequestSchema.index({ user: 1, status: 1, createdAt: -1 });

// Admin review queue — pending requests reviewed oldest-first (FIFO).
planUpgradeRequestSchema.index({ status: 1, createdAt: 1 });

// ─────────────────────────────────────────────
// Statics
// ─────────────────────────────────────────────

/**
 * The caller's currently pending request, if any. A user may have at most
 * one pending request at a time — enforced in
 * services/planUpgradeRequest.service.js#createUpgradeRequest, not by a
 * unique index here, since approved/rejected requests must remain in the
 * collection as history.
 */
planUpgradeRequestSchema.statics.findActivePendingForUser = function (userId) {
  return this.findOne({
    user: userId,
    status: PLAN_UPGRADE_REQUEST_STATUS.PENDING,
  });
};

// ── Expose enum for external use ──
planUpgradeRequestSchema.statics.STATUS = PLAN_UPGRADE_REQUEST_STATUS;

const PlanUpgradeRequest = mongoose.model(
  "PlanUpgradeRequest",
  planUpgradeRequestSchema,
);

export default PlanUpgradeRequest;
