const mongoose = require("mongoose");

// ── Incident lifecycle statuses ──
const STATUS = Object.freeze({
  ONGOING: "ongoing",
  INVESTIGATING: "investigating",
  IDENTIFIED: "identified",
  RESOLVED: "resolved",
});

const STATUS_VALUES = Object.values(STATUS);

// ── Severity levels ──
const SEVERITY = Object.freeze({
  CRITICAL: "critical",
  MAJOR: "major",
  MINOR: "minor",
});

const SEVERITY_VALUES = Object.values(SEVERITY);

const incidentSchema = new mongoose.Schema(
  {
    monitor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Monitor",
      required: [true, "Monitor reference is required"],
      index: true,
    },

    // ── The health check that triggered this incident ──
    triggerCheck: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "HealthCheck",
      default: null,
    },

    // ── Timing ──

    startedAt: {
      type: Date,
      required: [true, "Incident start time is required"],
      default: Date.now,
    },

    endedAt: {
      type: Date,
      default: null,
      validate: {
        validator(v) {
          return v === null || v >= this.startedAt;
        },
        message: "End time cannot be before start time",
      },
    },

    // Duration stored in seconds — auto-computed by pre-save hook.
    duration: {
      type: Number, // seconds
      default: null,
      min: [0, "Duration cannot be negative"],
    },

    // ── Classification ──

    status: {
      type: String,
      required: [true, "Incident status is required"],
      enum: {
        values: STATUS_VALUES,
        message: `Status must be one of: ${STATUS_VALUES.join(", ")}`,
      },
      default: STATUS.ONGOING,
    },

    // Severity is auto-derived by the incident manager based on health
    // check status: down → critical, degraded → minor, fallback → major.
    severity: {
      type: String,
      enum: {
        values: SEVERITY_VALUES,
        message: `Severity must be one of: ${SEVERITY_VALUES.join(", ")}`,
      },
      default: SEVERITY.MAJOR,
    },

    // ── Diagnostics ──

    rootCause: {
      type: String,
      trim: true,
      maxlength: [2000, "Root cause cannot exceed 2000 characters"],
      default: null,
    },

    resolutionNotes: {
      type: String,
      trim: true,
      maxlength: [5000, "Resolution notes cannot exceed 5000 characters"],
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

// Incident history for a monitor, newest first (detail page / timeline)
incidentSchema.index({ monitor: 1, startedAt: -1 });

// Active incidents across all monitors (dashboard alert banner)
incidentSchema.index({ status: 1, startedAt: -1 });

// Per-monitor active incidents (quick "is this monitor down?" check)
incidentSchema.index({ monitor: 1, status: 1 });

// Severity filter (ops triage view)
incidentSchema.index({ severity: 1, startedAt: -1 });

// Duration analytics (mean-time-to-resolve queries)
incidentSchema.index({ monitor: 1, duration: 1 });

// ─────────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────────

/**
 * Auto-compute duration when an incident is resolved.
 */
incidentSchema.pre("save", function (next) {
  if (this.endedAt && this.startedAt) {
    this.duration = Math.round((this.endedAt - this.startedAt) / 1000);
  }
  next();
});

// ─────────────────────────────────────────────
// Virtuals
// ─────────────────────────────────────────────

/**
 * True while the incident is unresolved.
 */
incidentSchema.virtual("isActive").get(function () {
  return this.status !== STATUS.RESOLVED;
});

/**
 * Human-readable duration string (e.g. "2h 15m 30s").
 */
incidentSchema.virtual("durationDisplay").get(function () {
  const s = this.duration;
  if (s == null) return "ongoing";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const parts = [];
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (sec || parts.length === 0) parts.push(`${sec}s`);
  return parts.join(" ");
});

// ─────────────────────────────────────────────
// Statics
// ─────────────────────────────────────────────

/**
 * Find all currently-active (unresolved) incidents.
 */
incidentSchema.statics.findActive = function () {
  return this.find({ status: { $ne: STATUS.RESOLVED } }).sort({
    startedAt: -1,
  });
};

/**
 * Find the current active incident for a specific monitor (if any).
 */
incidentSchema.statics.findActiveForMonitor = function (monitorId) {
  return this.findOne({
    monitor: monitorId,
    status: { $ne: STATUS.RESOLVED },
  }).sort({ startedAt: -1 });
};

/**
 * Resolve an incident: set endedAt, status, and optional notes.
 * Duration is computed automatically by the pre-save hook.
 */
incidentSchema.statics.resolve = async function (
  incidentId,
  { rootCause, resolutionNotes } = {},
) {
  const incident = await this.findById(incidentId);
  if (!incident) return null;

  incident.status = STATUS.RESOLVED;
  incident.endedAt = new Date();
  if (rootCause != null) incident.rootCause = rootCause;
  if (resolutionNotes != null) incident.resolutionNotes = resolutionNotes;

  return incident.save();
};

incidentSchema.statics.mttr = async function (
  monitorId,
  windowMs = 30 * 24 * 60 * 60 * 1000,
) {
  const since = new Date(Date.now() - windowMs);

  const [result] = await this.aggregate([
    {
      $match: {
        monitor: monitorId,
        status: STATUS.RESOLVED,
        duration: { $ne: null },
        startedAt: { $gte: since },
      },
    },
    { $group: { _id: null, avg: { $avg: "$duration" } } },
  ]);

  return result ? parseFloat(result.avg.toFixed(2)) : null;
};

// ── Expose enums ──
incidentSchema.statics.STATUS = STATUS;
incidentSchema.statics.SEVERITY = SEVERITY;

const Incident = mongoose.model("Incident", incidentSchema);

module.exports = Incident;
