import mongoose from "mongoose";
import {
  SLO_ROLLING_WINDOWS,
  SLO_ROLLING_WINDOW_MS,
  SLO_EVALUATION_INTERVALS,
  SLO_BURN_RATE_WINDOWS,
  SLO_SEVERITY,
} from "../config/constants.js";

const burnRateThresholdSchema = new mongoose.Schema(
  {
    window: {
      type: String,
      enum: {
        values: SLO_BURN_RATE_WINDOWS,
        message: `Window must be one of: ${SLO_BURN_RATE_WINDOWS.join(", ")}`,
      },
      default: "1h",
    },
    rate: {
      type: Number,
      required: true,
      min: [0.1, "Burn rate must be at least 0.1"],
      max: [100, "Burn rate cannot exceed 100"],
      default: 14.4,
    },
    severity: {
      type: String,
      enum: {
        values: SLO_SEVERITY,
        message: `Severity must be one of: ${SLO_SEVERITY.join(", ")}`,
      },
      default: "critical",
    },
  },
  { _id: false },
);

const alertSettingsSchema = new mongoose.Schema(
  {
    burnRateAlertsEnabled: {
      type: Boolean,
      default: true,
    },
    burnRateThresholds: {
      type: [burnRateThresholdSchema],
      default: () => [
        { window: "1h", rate: 14.4, severity: "critical" },
        { window: "6h", rate: 6.0, severity: "high" },
      ],
      validate: {
        validator(v) {
          return Array.isArray(v) && v.length <= 10;
        },
        message: "Cannot configure more than 10 burn rate thresholds",
      },
    },
    budgetExhaustedAlert: {
      type: Boolean,
      default: true,
    },
    budgetWarningThresholdPercent: {
      type: Number,
      min: [1, "Warning threshold must be at least 1%"],
      max: [50, "Warning threshold cannot exceed 50%"],
      default: 20,
    },
    cooldownMinutes: {
      type: Number,
      min: [5, "Cooldown must be at least 5 minutes"],
      max: [1440, "Cooldown cannot exceed 24 hours"],
      default: 60,
    },
    integrationIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "NotificationIntegration",
      },
    ],
  },
  { _id: false },
);

const measurementContractSchema = new mongoose.Schema(
  {
    maxIntervalAttributionSeconds: {
      type: Number,
      min: [30, "Attribution ceiling must be at least 30 seconds"],
      max: [86400, "Attribution ceiling cannot exceed 86400 seconds"],
      default: 3600,
    },
    minimumDataCoveragePercent: {
      type: Number,
      min: [50.0, "Minimum coverage must be at least 50%"],
      max: [100.0, "Minimum coverage cannot exceed 100%"],
      default: 95.0,
    },
    excludeMaintenance: {
      type: Boolean,
      default: true,
    },
    countDegradedAsDown: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false },
);

const auditChangeSchema = new mongoose.Schema(
  {
    changedAt: {
      type: Date,
      default: Date.now,
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    action: {
      type: String,
      enum: ["created", "updated", "status_changed"],
      default: "updated",
    },
    diff: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    reason: {
      type: String,
      trim: true,
      maxlength: [500, "Change reason cannot exceed 500 characters"],
      default: null,
    },
  },
  { _id: false },
);

const auditSchema = new mongoose.Schema(
  {
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Creator reference is required"],
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    changeHistory: {
      type: [auditChangeSchema],
      default: () => [],
    },
  },
  { _id: false },
);

const sloSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "SLO owner is required"],
      index: true,
    },
    monitor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Monitor",
      required: [true, "Monitor reference is required"],
      index: true,
    },
    name: {
      type: String,
      required: [true, "SLO name is required"],
      trim: true,
      minlength: [1, "SLO name cannot be empty"],
      maxlength: [120, "SLO name cannot exceed 120 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, "Description cannot exceed 1000 characters"],
      default: "",
    },
    targetPercentage: {
      type: Number,
      required: [true, "Target percentage is required"],
      min: [50.0, "Target percentage must be at least 50%"],
      max: [100.0, "Target percentage cannot exceed 100%"],
    },
    rollingWindow: {
      type: String,
      enum: {
        values: SLO_ROLLING_WINDOWS,
        message: `Rolling window must be one of: ${SLO_ROLLING_WINDOWS.join(", ")}`,
      },
      default: "30d",
    },
    evaluationInterval: {
      type: String,
      enum: {
        values: SLO_EVALUATION_INTERVALS,
        message: `Evaluation interval must be one of: ${SLO_EVALUATION_INTERVALS.join(", ")}`,
      },
      default: "1h",
    },
    enabled: {
      type: Boolean,
      default: true,
      index: true,
    },
    alertSettings: {
      type: alertSettingsSchema,
      default: () => ({}),
    },
    measurementContract: {
      type: measurementContractSchema,
      default: () => ({}),
    },
    audit: {
      type: auditSchema,
      required: true,
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

// ── Compound Indexes ──
// Scoped per owner and monitor: unique SLO name per monitor
sloSchema.index({ owner: 1, monitor: 1, name: 1 }, { unique: true });
sloSchema.index({ monitor: 1, enabled: 1 });
sloSchema.index({ owner: 1, createdAt: -1 });

// ── Virtuals ──
sloSchema.virtual("rollingWindowMs").get(function () {
  return SLO_ROLLING_WINDOW_MS[this.rollingWindow] || 30 * 86400000;
});

sloSchema.virtual("rollingWindowDays").get(function () {
  const ms = this.rollingWindowMs;
  return ms / (24 * 60 * 60 * 1000);
});

sloSchema.virtual("evaluationIntervalSeconds").get(function () {
  const map = {
    "1m": 60,
    "5m": 300,
    "15m": 900,
    "30m": 1800,
    "1h": 3600,
    "6h": 21600,
    "24h": 86400,
  };
  return map[this.evaluationInterval] || 3600;
});

sloSchema.virtual("allowedDowntimeMinutes").get(function () {
  const totalMinutes = this.rollingWindowDays * 24 * 60;
  const downtime = (1 - this.targetPercentage / 100) * totalMinutes;
  return Number(downtime.toFixed(2));
});

const Slo = mongoose.model("Slo", sloSchema);

export default Slo;
