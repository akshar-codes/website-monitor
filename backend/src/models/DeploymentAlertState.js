import mongoose from "mongoose";

export const REGRESSION_TYPES = Object.freeze({
  LATENCY: "latency",
  FAILURE_RATE: "failure_rate",
  INCIDENT: "incident",
  COMBINED: "combined",
});

export const REGRESSION_TYPE_VALUES = Object.freeze(
  Object.values(REGRESSION_TYPES),
);

export const REGRESSION_STATUSES = Object.freeze({
  EVALUATING: "evaluating",
  NORMAL: "normal",
  SUSPECTED_REGRESSION: "suspected_regression",
  INSUFFICIENT_DATA: "insufficient_data",
});

export const REGRESSION_STATUS_VALUES = Object.freeze(
  Object.values(REGRESSION_STATUSES),
);

export const NOTIFICATION_STATES = Object.freeze({
  IDLE: "idle",
  PENDING: "pending",
  DISPATCHING: "dispatching",
  SENT: "sent",
  FAILED: "failed",
});

export const NOTIFICATION_STATE_VALUES = Object.freeze(
  Object.values(NOTIFICATION_STATES),
);

export const DEFAULT_CORRELATION_DISCLAIMER =
  "Temporal association detected. Performance changes or incidents occurred following release deployment. This indicates correlation, not proven causation. Manual verification is advised before rolling back.";

const deploymentAlertStateSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Owner reference is required"],
      index: true,
    },
    monitor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Monitor",
      required: [true, "Monitor reference is required"],
      index: true,
    },
    deployment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeploymentEvent",
      required: [true, "Deployment reference is required"],
      index: true,
    },
    regressionType: {
      type: String,
      enum: REGRESSION_TYPE_VALUES,
      required: [true, "Regression type is required"],
      default: REGRESSION_TYPES.COMBINED,
    },
    status: {
      type: String,
      enum: REGRESSION_STATUS_VALUES,
      required: [true, "Regression status is required"],
      default: REGRESSION_STATUSES.EVALUATING,
      index: true,
    },
    deduplicationKey: {
      type: String,
      required: [true, "Deduplication key is required"],
      unique: true,
    },
    windowMinutes: {
      type: Number,
      required: true,
      default: 30,
      min: 5,
      max: 1440,
    },
    thresholds: {
      minSampleCount: { type: Number, default: 3 },
      medianLatencyIncreaseMs: { type: Number, default: 30 },
      medianLatencyIncreasePercent: { type: Number, default: 20 },
      p95LatencyIncreaseMs: { type: Number, default: 50 },
      p95LatencyIncreasePercent: { type: Number, default: 25 },
      failureRateIncreasePercent: { type: Number, default: 5.0 },
      availabilityDropPercent: { type: Number, default: 5.0 },
    },
    metricsSnapshot: {
      before: { type: mongoose.Schema.Types.Mixed, default: null },
      after: { type: mongoose.Schema.Types.Mixed, default: null },
      diff: { type: mongoose.Schema.Types.Mixed, default: null },
    },
    evidence: {
      type: [String],
      default: [],
    },
    relatedIncidents: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Incident",
      },
    ],
    disclaimer: {
      type: String,
      default: DEFAULT_CORRELATION_DISCLAIMER,
    },
    alertDispatchedAt: {
      type: Date,
      default: null,
    },
    cooldownUntil: {
      type: Date,
      default: null,
    },
    notificationState: {
      type: String,
      enum: NOTIFICATION_STATE_VALUES,
      default: NOTIFICATION_STATES.IDLE,
      index: true,
    },
    notificationLeaseUntil: {
      type: Date,
      default: null,
    },
    notificationDispatchedAt: {
      type: Date,
      default: null,
    },
    lastNotifiedRegressionType: {
      type: String,
      default: null,
    },
    notificationAttempts: {
      type: Number,
      default: 0,
    },
    lastNotificationError: {
      type: String,
      default: null,
    },
    notificationHistory: [
      {
        attemptedAt: { type: Date, default: Date.now },
        state: { type: String, enum: NOTIFICATION_STATE_VALUES },
        regressionType: { type: String, default: null },
        error: { type: String, default: null },
      },
    ],
    lastEvaluatedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    retryCount: {
      type: Number,
      default: 0,
    },
    lastError: {
      type: String,
      default: null,
    },
    leaseToken: {
      type: String,
      select: false,
      default: null,
    },
    leaseUntil: {
      type: Date,
      select: false,
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
        delete ret.leaseToken;
        delete ret.leaseUntil;
        return ret;
      },
    },
    toObject: { virtuals: true },
  },
);

deploymentAlertStateSchema.index(
  { deployment: 1, monitor: 1 },
  { unique: true },
);
deploymentAlertStateSchema.index({ monitor: 1, deployment: 1 });
deploymentAlertStateSchema.index({ owner: 1, status: 1 });
deploymentAlertStateSchema.index({ monitor: 1, lastEvaluatedAt: -1 });

const DeploymentAlertState = mongoose.model(
  "DeploymentAlertState",
  deploymentAlertStateSchema,
);

export default DeploymentAlertState;
