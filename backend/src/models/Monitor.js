import mongoose from "mongoose";
import { INTERVAL_PRESETS } from "../config/constants.js";

const monitorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Monitor name is required"],
      trim: true,
      minlength: [1, "Name cannot be empty"],
      maxlength: [120, "Name cannot exceed 120 characters"],
    },

    url: {
      type: String,
      required: [true, "URL is required"],
      trim: true,
      validate: {
        validator(v) {
          try {
            const parsed = new URL(v);
            return ["http:", "https:"].includes(parsed.protocol);
          } catch {
            return false;
          }
        },
        message: (props) => `"${props.value}" is not a valid HTTP/HTTPS URL`,
      },
    },

    interval: {
      type: Number,
      required: [true, "Poll interval is required"],
      enum: {
        values: INTERVAL_PRESETS,
        message: `Interval must be one of: ${INTERVAL_PRESETS.join(", ")} (seconds)`,
      },
      default: 300, // 5 minutes
    },

    active: {
      type: Boolean,
      default: true,
    },

    // ── Worker fields ──

    lastCheckedAt: {
      type: Date,
      default: null,
    },

    nextCheckAt: {
      type: Date,
      default: Date.now, // first check fires immediately
    },

    consecutiveFailures: {
      type: Number,
      default: 0,
      min: [0, "Consecutive failures cannot be negative"],
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

    toObject: {
      virtuals: true,
    },
  },
);

// ── Indexes ──

// Fast lookup by URL (each URL should only be monitored once)
monitorSchema.index({ url: 1 }, { unique: true });

// Query active monitors quickly (scheduler's hot path)
monitorSchema.index({ active: 1 });

// Compound: active monitors sorted by interval
monitorSchema.index({ active: 1, interval: 1 });

// Scheduler query: active monitors that are due for a check
monitorSchema.index({ active: 1, nextCheckAt: 1 });

// ── Virtuals ──

/**
 * Human-readable interval string (e.g. "5 min", "1 hr").
 */
monitorSchema.virtual("intervalDisplay").get(function () {
  const s = this.interval;
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${s / 60} min`;
  return `${s / 3600} hr`;
});

// ── Static helpers ──

/**
 * Return all active monitors, optionally sorted.
 */
monitorSchema.statics.findActive = function (sort = { interval: 1 }) {
  return this.find({ active: true }).sort(sort);
};

/**
 * Return active monitors whose nextCheckAt <= now (due for polling).
 */
monitorSchema.statics.findDue = function () {
  return this.find({
    active: true,
    nextCheckAt: { $lte: new Date() },
  });
};

// ── Constants attached to the model for external reference ──
monitorSchema.statics.INTERVAL_PRESETS = INTERVAL_PRESETS;

const Monitor = mongoose.model("Monitor", monitorSchema);

export default Monitor;
