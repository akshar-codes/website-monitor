import mongoose from "mongoose";
import { INTERVAL_PRESETS } from "../config/constants.js";

const monitorSchema = new mongoose.Schema(
  {
    // BREAKING CHANGE: monitors are now owned by a single user rather than
    // being a global/shared resource. Required for plan-based monitor
    // limits and per-user dashboard/incident scoping to be meaningful —
    // see services/usage.service.js and scripts/migrateMonitorOwners.js
    // for the one-off backfill needed on any pre-existing database.
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Monitor owner is required"],
      index: true,
    },

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

    // ── Worker fields (health checks) ──

    lastCheckedAt: {
      type: Date,
      default: null,
    },

    nextCheckAt: {
      type: Date,
      default: Date.now, // first check fires immediately
    },

    // Mongo-backed lease makes scheduled checks exclusive across API replicas.
    // Expired leases are reclaimable, so process restarts cannot strand jobs.
    checkLeaseToken: { type: String, default: null, select: false },
    checkLeaseUntil: { type: Date, default: null, select: false },
    checkRetryAt: { type: Date, default: null, select: false },

    consecutiveFailures: {
      type: Number,
      default: 0,
      min: [0, "Consecutive failures cannot be negative"],
    },
    consecutiveSuccesses: { type: Number, default: 0, min: 0 },
    lastIncidentCheckId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "HealthCheck",
      default: null,
      select: false,
    },

    // ── Worker fields (SSL / domain monitoring) ──
    // Additive, optional fields — mirrors lastCheckedAt/nextCheckAt above
    // but on the SSL scheduler's own, much slower cadence (see
    // workers/sslScheduler.js and config/env.js#SSL_CHECK_INTERVAL_MS).
    // Existing monitor documents created before this feature shipped
    // hydrate these via their schema defaults automatically — no
    // migration is needed (same rationale as models/User.js's optional
    // profile fields).

    // Only meaningful for HTTPS monitors; toggled from the SSL panel in
    // the monitor detail page. Defaults to true so every eligible
    // monitor is covered unless a user opts out.
    sslMonitoringEnabled: {
      type: Boolean,
      default: true,
    },

    lastSslCheckedAt: {
      type: Date,
      default: null,
    },

    nextSslCheckAt: {
      type: Date,
      default: Date.now, // first SSL check fires on the scheduler's next tick
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

// Fast lookup by URL. Uniqueness is scoped per-owner so different
// users can monitor the same URL.
monitorSchema.index({ owner: 1, url: 1 }, { unique: true });

// Query active monitors quickly (scheduler's hot path — global, unscoped
// by design; the polling worker has no concept of "the current user").
monitorSchema.index({ active: 1 });
monitorSchema.index({ active: 1, interval: 1 });
monitorSchema.index({ active: 1, nextCheckAt: 1 });

// SSL scheduler's due-query hot path — mirrors the health-check indexes
// above, scoped additionally to sslMonitoringEnabled so disabled
// monitors are excluded at the index level rather than filtered in JS.
monitorSchema.index({ active: 1, sslMonitoringEnabled: 1, nextSslCheckAt: 1 });

// Per-user monitor listing / usage-limit counting (Monitors page, the
// usage dashboard, and requireWithinLimit's countFn all hit this shape).
monitorSchema.index({ owner: 1, active: 1 });
monitorSchema.index({ owner: 1, createdAt: -1 });

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
 * Return all active monitors, optionally sorted. Intentionally global and
 * unscoped by owner — used only by the polling scheduler, which must
 * check every monitor in the system regardless of who owns it.
 */
monitorSchema.statics.findActive = function (sort = { interval: 1 }) {
  return this.find({ active: true }).sort(sort);
};

/**
 * Return active monitors whose nextCheckAt <= now (due for polling).
 * Global/unscoped — see findActive above for the rationale.
 */
monitorSchema.statics.findDue = function () {
  return this.find({
    active: true,
    nextCheckAt: { $lte: new Date() },
  });
};

/**
 * Return active, SSL-monitoring-enabled, HTTPS monitors whose
 * nextSslCheckAt <= now (due for an SSL/domain recheck). Global/unscoped
 * — used only by workers/sslScheduler.js, mirroring findDue's rationale
 * above. The `url` regex restricts the due-set to HTTPS monitors at the
 * query level so an HTTP-only monitor is never pulled into the SSL check
 * pipeline in the first place.
 */
monitorSchema.statics.findDueSsl = function () {
  return this.find({
    active: true,
    sslMonitoringEnabled: true,
    url: { $regex: /^https:\/\//i },
    nextSslCheckAt: { $lte: new Date() },
  });
};

// ── Constants attached to the model for external reference ──
monitorSchema.statics.INTERVAL_PRESETS = INTERVAL_PRESETS;

const Monitor = mongoose.model("Monitor", monitorSchema);

export default Monitor;
