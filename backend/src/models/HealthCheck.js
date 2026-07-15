import mongoose from "mongoose";
import { HEALTH_STATUS, FAILURE_REASONS } from "../config/constants.js";

const STATUS_VALUES = Object.values(HEALTH_STATUS);
const FAILURE_REASON_VALUES = Object.values(FAILURE_REASONS);

// Reusable sub-schema for component-level status
const componentStatusSchema = {
  type: String,
  enum: {
    values: STATUS_VALUES,
    message: `Status must be one of: ${STATUS_VALUES.join(", ")}`,
  },
  default: HEALTH_STATUS.UNKNOWN,
};

const healthCheckSchema = new mongoose.Schema(
  {
    monitor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Monitor",
      required: [true, "Monitor reference is required"],
      index: true,
    },

    // ── Overall verdict ──
    status: {
      ...componentStatusSchema,
      required: [true, "Overall status is required"],
    },

    // ── Component-level statuses ──
    frontendStatus: componentStatusSchema,
    backendStatus: componentStatusSchema,
    databaseStatus: componentStatusSchema,

    // ── Performance ──
    responseTime: {
      type: Number, // milliseconds
      required: [true, "Response time is required"],
      min: [0, "Response time cannot be negative"],
    },

    // ── HTTP status code from the polled endpoint ──
    httpStatus: {
      type: Number,
      default: null,
      validate: {
        validator(v) {
          return v === null || (v >= 100 && v <= 599);
        },
        message: "HTTP status must be between 100 and 599",
      },
    },

    // ── Why the check failed (null when status is "up") ──
    failureReason: {
      type: String,
      enum: {
        values: [...FAILURE_REASON_VALUES, null],
        message: `Failure reason must be one of: ${FAILURE_REASON_VALUES.join(", ")}`,
      },
      default: null,
    },

    // ── Raw payload from the monitored endpoint ──
    rawResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    // ── When the check was performed ──
    checkedAt: {
      type: Date,
      required: [true, "Check timestamp is required"],
      default: Date.now,
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
// Indexes — tuned for dashboard query patterns
// ─────────────────────────────────────────────

// Latest checks for a specific monitor (timeline view)
healthCheckSchema.index({ monitor: 1, checkedAt: -1 });

// Filter by status across all monitors (incident dashboard)
healthCheckSchema.index({ status: 1, checkedAt: -1 });

// Per-monitor status history (uptime calculation)
healthCheckSchema.index({ monitor: 1, status: 1, checkedAt: -1 });

// Response-time analytics (P95 / P99 charts)
healthCheckSchema.index({ monitor: 1, responseTime: 1 });

// ─────────────────────────────────────────────
// Virtuals
// ─────────────────────────────────────────────

/**
 * True when every component reports "up".
 */
healthCheckSchema.virtual("isHealthy").get(function () {
  return (
    this.status === HEALTH_STATUS.UP &&
    this.frontendStatus === HEALTH_STATUS.UP &&
    this.backendStatus === HEALTH_STATUS.UP &&
    this.databaseStatus === HEALTH_STATUS.UP
  );
});

// ─────────────────────────────────────────────
// Statics
// ─────────────────────────────────────────────

/**
 * Return the most recent check for a given monitor.
 */
healthCheckSchema.statics.findLatest = function (monitorId) {
  return this.findOne({ monitor: monitorId }).sort({ checkedAt: -1 });
};

/**
 * Return the last `n` checks for a monitor (newest first).
 */
healthCheckSchema.statics.findRecent = function (monitorId, limit = 20) {
  return this.find({ monitor: monitorId }).sort({ checkedAt: -1 }).limit(limit);
};

healthCheckSchema.statics.uptimePercent = async function (
  monitorId,
  windowMs = 24 * 60 * 60 * 1000,
) {
  const since = new Date(Date.now() - windowMs);

  const [result] = await this.aggregate([
    { $match: { monitor: monitorId, checkedAt: { $gte: since } } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        up: { $sum: { $cond: [{ $eq: ["$status", HEALTH_STATUS.UP] }, 1, 0] } },
      },
    },
  ]);

  if (!result || result.total === 0) return 0;
  return parseFloat(((result.up / result.total) * 100).toFixed(2));
};

healthCheckSchema.statics.avgResponseTime = async function (
  monitorId,
  windowMs = 24 * 60 * 60 * 1000,
) {
  const since = new Date(Date.now() - windowMs);

  const [result] = await this.aggregate([
    { $match: { monitor: monitorId, checkedAt: { $gte: since } } },
    { $group: { _id: null, avg: { $avg: "$responseTime" } } },
  ]);

  return result ? parseFloat(result.avg.toFixed(2)) : 0;
};

// ── Expose enums for external use ──
healthCheckSchema.statics.STATUS = HEALTH_STATUS;
healthCheckSchema.statics.FAILURE_REASONS = FAILURE_REASONS;

const HealthCheck = mongoose.model("HealthCheck", healthCheckSchema);

export default HealthCheck;
