import mongoose from "mongoose";
import { JOB_RUN_STATUS, JOB_RUN_STATUS_VALUES } from "../config/constants.js";
import {
  sanitizeRunOutput,
  sanitizeRunMetadata,
} from "../services/jobSchedule.service.js";

const jobRunSchema = new mongoose.Schema(
  {
    jobMonitor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "JobMonitor",
      required: [true, "Job monitor reference is required"],
      index: true,
    },
    runId: {
      type: String,
      required: [true, "Run ID is required"],
      trim: true,
      index: true,
    },
    // Scheduled slot identifier (e.g. ISO tick timestamp)
    occurrenceKey: {
      type: String,
      default: null,
      index: true,
    },
    scheduledFor: {
      type: Date,
      default: null,
      index: true,
    },

    // ── Status ──
    status: {
      type: String,
      enum: {
        values: JOB_RUN_STATUS_VALUES,
        message: `Status must be one of: ${JOB_RUN_STATUS_VALUES.join(", ")}`,
      },
      required: [true, "Execution status is required"],
      index: true,
    },

    // ── Execution Timing ──
    startedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    // Server-side received timestamp — authoritative audit ground truth
    receivedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    durationMs: {
      type: Number,
      min: [0, "Duration cannot be negative"],
      default: null,
    },

    // ── Failure Information (Sanitized & Bounded) ──
    exitCode: {
      type: Number,
      default: null,
    },
    errorMessage: {
      type: String,
      trim: true,
      maxlength: [1000, "Error message cannot exceed 1000 characters"],
      default: null,
    },
    failureReason: {
      type: String,
      trim: true,
      maxlength: [200, "Failure reason cannot exceed 200 characters"],
      default: null,
    },
    output: {
      type: String,
      trim: true,
      maxlength: [5000, "Output log snippet cannot exceed 5000 characters"],
      default: null,
    },

    // ── Bounded Metadata ──
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    // ── Late Ping Reconciliation ──
    late: {
      type: Boolean,
      default: false,
    },
    delaySeconds: {
      type: Number,
      default: null,
    },
    reconciledLate: {
      type: Boolean,
      default: false,
    },

    // ── Client Request Context ──
    clientIp: {
      type: String,
      trim: true,
      maxlength: [45, "Client IP cannot exceed 45 characters"],
      default: null,
    },
    userAgent: {
      type: String,
      trim: true,
      maxlength: [300, "User agent cannot exceed 300 characters"],
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        ret.id = String(ret._id);
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

// ── Pre-Validate & Pre-Save Hooks (Sanitization & Duration Calculation) ──
function applySanitizationAndDuration() {
  if (this.output) {
    this.output = sanitizeRunOutput(this.output, 5000);
  }
  if (this.metadata) {
    this.metadata = sanitizeRunMetadata(this.metadata, 20);
  }
  if (this.durationMs == null && this.startedAt && this.completedAt) {
    const start = new Date(this.startedAt).getTime();
    const end = new Date(this.completedAt).getTime();
    if (end >= start) {
      this.durationMs = end - start;
    }
  }
}

jobRunSchema.pre("validate", function (next) {
  applySanitizationAndDuration.call(this);
  if (typeof next === "function") next();
});

jobRunSchema.pre("save", async function () {
  applySanitizationAndDuration.call(this);
});

// ── Compound Indexes ──
jobRunSchema.index({ jobMonitor: 1, runId: 1 }, { unique: true });
jobRunSchema.index({ jobMonitor: 1, scheduledFor: -1 });
jobRunSchema.index({ jobMonitor: 1, createdAt: -1 });
jobRunSchema.index({ jobMonitor: 1, status: 1, createdAt: -1 });
jobRunSchema.index({ jobMonitor: 1, occurrenceKey: 1 }, { sparse: true });

// ── Virtuals ──
jobRunSchema.virtual("isFinished").get(function () {
  return [
    JOB_RUN_STATUS.SUCCEEDED,
    JOB_RUN_STATUS.FAILED,
    JOB_RUN_STATUS.TIMED_OUT,
    JOB_RUN_STATUS.MISSED,
  ].includes(this.status);
});

jobRunSchema.virtual("durationSeconds").get(function () {
  return this.durationMs != null
    ? Number((this.durationMs / 1000).toFixed(2))
    : null;
});

// ── Statics ──
jobRunSchema.statics.findLatestForMonitor = function (jobMonitorId) {
  return this.findOne({ jobMonitor: jobMonitorId }).sort({ createdAt: -1 });
};

jobRunSchema.statics.findRecentForMonitor = function (
  jobMonitorId,
  limit = 20,
) {
  return this.find({ jobMonitor: jobMonitorId })
    .sort({ createdAt: -1 })
    .limit(limit);
};

// ── Expose Enums ──
jobRunSchema.statics.STATUS = JOB_RUN_STATUS;
jobRunSchema.statics.STATUS_VALUES = JOB_RUN_STATUS_VALUES;

const JobRun = mongoose.model("JobRun", jobRunSchema);

export default JobRun;
