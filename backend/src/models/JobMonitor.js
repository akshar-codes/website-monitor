import mongoose from "mongoose";
import {
  JOB_SCHEDULE_TYPES,
  JOB_SCHEDULE_TYPE_VALUES,
  JOB_STATUS,
  JOB_STATUS_VALUES,
  JOB_RUN_STATUS_VALUES,
  JOB_MONITOR_LIMITS,
} from "../config/constants.js";
import {
  validateScheduleConfig,
  formatScheduleDisplay,
  generateJobToken,
} from "../services/jobSchedule.service.js";

const jobMonitorSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Job monitor owner is required"],
      index: true,
    },
    name: {
      type: String,
      required: [true, "Job monitor name is required"],
      trim: true,
      minlength: [1, "Name cannot be empty"],
      maxlength: [120, "Name cannot exceed 120 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, "Description cannot exceed 1000 characters"],
      default: "",
    },

    // ── Schedule Definition ──
    scheduleType: {
      type: String,
      enum: {
        values: JOB_SCHEDULE_TYPE_VALUES,
        message: `Schedule type must be one of: ${JOB_SCHEDULE_TYPE_VALUES.join(", ")}`,
      },
      required: [true, "Schedule type is required"],
      default: JOB_SCHEDULE_TYPES.INTERVAL,
    },
    intervalSeconds: {
      type: Number,
      min: [
        JOB_MONITOR_LIMITS.MIN_INTERVAL_SECONDS,
        `Interval must be at least ${JOB_MONITOR_LIMITS.MIN_INTERVAL_SECONDS} seconds`,
      ],
      max: [
        JOB_MONITOR_LIMITS.MAX_INTERVAL_SECONDS,
        `Interval cannot exceed ${JOB_MONITOR_LIMITS.MAX_INTERVAL_SECONDS} seconds`,
      ],
      default: null,
    },
    cronExpression: {
      type: String,
      trim: true,
      maxlength: [100, "Cron expression cannot exceed 100 characters"],
      default: null,
    },
    timezone: {
      type: String,
      trim: true,
      default: "UTC",
    },

    // ── Tolerance & Thresholds ──
    gracePeriodSeconds: {
      type: Number,
      min: [
        JOB_MONITOR_LIMITS.MIN_GRACE_PERIOD_SECONDS,
        `Grace period must be at least ${JOB_MONITOR_LIMITS.MIN_GRACE_PERIOD_SECONDS} seconds`,
      ],
      max: [
        JOB_MONITOR_LIMITS.MAX_GRACE_PERIOD_SECONDS,
        `Grace period cannot exceed ${JOB_MONITOR_LIMITS.MAX_GRACE_PERIOD_SECONDS} seconds`,
      ],
      default: JOB_MONITOR_LIMITS.DEFAULT_GRACE_PERIOD_SECONDS,
    },
    runTimeoutSeconds: {
      type: Number,
      min: [
        JOB_MONITOR_LIMITS.MIN_RUN_TIMEOUT_SECONDS,
        `Run timeout must be at least ${JOB_MONITOR_LIMITS.MIN_RUN_TIMEOUT_SECONDS} seconds`,
      ],
      max: [
        JOB_MONITOR_LIMITS.MAX_RUN_TIMEOUT_SECONDS,
        `Run timeout cannot exceed ${JOB_MONITOR_LIMITS.MAX_RUN_TIMEOUT_SECONDS} seconds`,
      ],
      default: JOB_MONITOR_LIMITS.DEFAULT_RUN_TIMEOUT_SECONDS,
    },
    failureThreshold: {
      type: Number,
      min: [
        JOB_MONITOR_LIMITS.MIN_FAILURE_THRESHOLD,
        `Failure threshold must be at least ${JOB_MONITOR_LIMITS.MIN_FAILURE_THRESHOLD}`,
      ],
      max: [
        JOB_MONITOR_LIMITS.MAX_FAILURE_THRESHOLD,
        `Failure threshold cannot exceed ${JOB_MONITOR_LIMITS.MAX_FAILURE_THRESHOLD}`,
      ],
      default: JOB_MONITOR_LIMITS.DEFAULT_FAILURE_THRESHOLD,
    },
    recoveryThreshold: {
      type: Number,
      min: [
        JOB_MONITOR_LIMITS.MIN_RECOVERY_THRESHOLD,
        `Recovery threshold must be at least ${JOB_MONITOR_LIMITS.MIN_RECOVERY_THRESHOLD}`,
      ],
      max: [
        JOB_MONITOR_LIMITS.MAX_RECOVERY_THRESHOLD,
        `Recovery threshold cannot exceed ${JOB_MONITOR_LIMITS.MAX_RECOVERY_THRESHOLD}`,
      ],
      default: JOB_MONITOR_LIMITS.DEFAULT_RECOVERY_THRESHOLD,
    },

    // ── Status & State ──
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
    status: {
      type: String,
      enum: {
        values: JOB_STATUS_VALUES,
        message: `Status must be one of: ${JOB_STATUS_VALUES.join(", ")}`,
      },
      default: JOB_STATUS.PENDING,
      index: true,
    },
    lastRunStatus: {
      type: String,
      enum: [...JOB_RUN_STATUS_VALUES, null],
      default: null,
    },

    // ── Security & Authentication Tokens ──
    tokenPrefix: {
      type: String,
      required: true,
      unique: true,
      default: function () {
        if (!this._generatedToken) {
          this._generatedToken = generateJobToken();
        }
        return this._generatedToken.prefix;
      },
    },
    tokenHash: {
      type: String,
      required: true,
      select: false,
      default: function () {
        if (!this._generatedToken) {
          this._generatedToken = generateJobToken();
        }
        return this._generatedToken.tokenHash;
      },
    },
    tokenRotatedAt: {
      type: Date,
      default: null,
    },
    previousTokenHash: {
      type: String,
      select: false,
      default: null,
    },

    // ── Execution Metadata & Timestamps (UTC) ──
    lastPingAt: {
      type: Date,
      default: null,
    },
    lastStartedAt: {
      type: Date,
      default: null,
    },
    lastFinishedAt: {
      type: Date,
      default: null,
    },
    lastDurationMs: {
      type: Number,
      min: 0,
      default: null,
    },
    currentRunId: {
      type: String,
      default: null,
    },
    currentRunStartedAt: {
      type: Date,
      default: null,
    },

    // ── Counters ──
    consecutiveFailures: {
      type: Number,
      default: 0,
      min: 0,
    },
    consecutiveMissed: {
      type: Number,
      default: 0,
      min: 0,
    },
    consecutiveSuccesses: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ── Scheduling & Distributed Claims ──
    nextExpectedAt: {
      type: Date,
      default: null,
      index: true,
    },
    nextEvaluationAt: {
      type: Date,
      default: null,
      index: true,
    },
    leaseToken: {
      type: String,
      default: null,
      select: false,
    },
    leaseUntil: {
      type: Date,
      default: null,
      select: false,
    },
    retryAt: {
      type: Date,
      default: null,
      select: false,
    },

    // ── Notification Integrations ──
    integrationIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "NotificationIntegration",
      },
    ],
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        ret.id = String(ret._id);
        delete ret._id;
        delete ret.__v;
        delete ret.tokenHash;
        delete ret.previousTokenHash;
        delete ret.leaseToken;
        delete ret.leaseUntil;
        delete ret.retryAt;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
    },
  },
);

// ── Validation Pre-Hook ──
jobMonitorSchema.pre("validate", function validateSchedule(next) {
  // Auto-generate token if not set
  if (!this.tokenPrefix || !this.tokenHash) {
    const { prefix, tokenHash } = generateJobToken();
    this.tokenPrefix = this.tokenPrefix || prefix;
    this.tokenHash = this.tokenHash || tokenHash;
  }

  const validation = validateScheduleConfig({
    scheduleType: this.scheduleType,
    intervalSeconds: this.intervalSeconds,
    cronExpression: this.cronExpression,
    timezone: this.timezone,
    gracePeriodSeconds: this.gracePeriodSeconds,
    runTimeoutSeconds: this.runTimeoutSeconds,
    failureThreshold: this.failureThreshold,
    recoveryThreshold: this.recoveryThreshold,
  });

  if (!validation.valid) {
    for (const err of validation.errors) {
      if (err.includes("interval")) {
        this.invalidate("intervalSeconds", err);
      } else if (err.includes("cron")) {
        this.invalidate("cronExpression", err);
      } else if (err.includes("timezone")) {
        this.invalidate("timezone", err);
      } else if (err.includes("gracePeriod")) {
        this.invalidate("gracePeriodSeconds", err);
      } else if (err.includes("runTimeout")) {
        this.invalidate("runTimeoutSeconds", err);
      } else {
        this.invalidate("scheduleType", err);
      }
    }
  }

  if (typeof next === "function") next();
});

// ── Compound Indexes ──
jobMonitorSchema.index({ owner: 1, name: 1 }, { unique: true });
jobMonitorSchema.index({ tokenPrefix: 1 }, { unique: true });
jobMonitorSchema.index({ tokenHash: 1 }, { unique: true, sparse: true });
jobMonitorSchema.index({ active: 1, nextEvaluationAt: 1, _id: 1 });
jobMonitorSchema.index({ active: 1, nextExpectedAt: 1, _id: 1 });
jobMonitorSchema.index({ owner: 1, active: 1 });
jobMonitorSchema.index({ owner: 1, createdAt: -1 });

// ── Virtuals ──
jobMonitorSchema.virtual("scheduleDisplay").get(function () {
  return formatScheduleDisplay({
    scheduleType: this.scheduleType,
    intervalSeconds: this.intervalSeconds,
    cronExpression: this.cronExpression,
    timezone: this.timezone,
  });
});

jobMonitorSchema.virtual("isOverdue").get(function () {
  if (
    !this.active ||
    this.status === JOB_STATUS.PAUSED ||
    !this.nextExpectedAt
  ) {
    return false;
  }
  const graceMs = (this.gracePeriodSeconds || 300) * 1000;
  return Date.now() > this.nextExpectedAt.getTime() + graceMs;
});

jobMonitorSchema.virtual("isRunning").get(function () {
  return Boolean(this.currentRunStartedAt);
});

jobMonitorSchema.virtual("isHealthy").get(function () {
  return this.status === JOB_STATUS.UP;
});

// ── Statics ──
jobMonitorSchema.statics.findActive = function (query = {}) {
  return this.find({ active: true, ...query });
};

jobMonitorSchema.statics.findDueEvaluation = function (now = new Date()) {
  return this.find({
    active: true,
    nextEvaluationAt: { $lte: now },
  });
};

jobMonitorSchema.statics.findDueMissed = function (now = new Date()) {
  return this.find({
    active: true,
    nextExpectedAt: { $lte: now },
  });
};

const JobMonitor = mongoose.model("JobMonitor", jobMonitorSchema);

export default JobMonitor;
