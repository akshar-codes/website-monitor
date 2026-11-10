import mongoose from "mongoose";

const sloSnapshotSchema = new mongoose.Schema(
  {
    slo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Slo",
      required: [true, "SLO reference is required"],
      index: true,
    },
    monitor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Monitor",
      required: [true, "Monitor reference is required"],
      index: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Owner reference is required"],
      index: true,
    },
    evaluatedAt: {
      type: Date,
      required: [true, "Evaluated timestamp is required"],
      default: Date.now,
      index: true,
    },
    windowStart: {
      type: Date,
      required: true,
    },
    windowEnd: {
      type: Date,
      required: true,
    },
    effectiveWindowStart: {
      type: Date,
      required: true,
    },
    calculationVersion: {
      type: Number,
      required: true,
      default: 1,
    },
    targetPercentage: {
      type: Number,
      required: true,
    },
    rollingWindow: {
      type: String,
      required: true,
    },
    sliPercentage: {
      type: Number,
      default: null,
    },
    status: {
      type: String,
      enum: ["healthy", "warning", "breached", "insufficient_data"],
      required: true,
      index: true,
    },
    goodDurationSeconds: {
      type: Number,
      default: 0,
      min: 0,
    },
    badDurationSeconds: {
      type: Number,
      default: 0,
      min: 0,
    },
    unknownDurationSeconds: {
      type: Number,
      default: 0,
      min: 0,
    },
    maintenanceDurationSeconds: {
      type: Number,
      default: 0,
      min: 0,
    },
    observedDurationSeconds: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalWindowSeconds: {
      type: Number,
      default: 0,
      min: 0,
    },
    effectiveWindowSeconds: {
      type: Number,
      default: 0,
      min: 0,
    },
    eligibleWindowSeconds: {
      type: Number,
      default: 0,
      min: 0,
    },
    coveragePercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    allowedBudgetSeconds: {
      type: Number,
      default: 0,
      min: 0,
    },
    consumedBudgetSeconds: {
      type: Number,
      default: 0,
      min: 0,
    },
    remainingBudgetSeconds: {
      type: Number,
      default: 0,
    },
    remainingBudgetPercentage: {
      type: Number,
      default: 0,
    },
    budgetConsumptionPercentage: {
      type: Number,
      default: 0,
      min: 0,
    },
    sampleCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    goodChecks: {
      type: Number,
      default: 0,
      min: 0,
    },
    badChecks: {
      type: Number,
      default: 0,
      min: 0,
    },
    degradedChecks: {
      type: Number,
      default: 0,
      min: 0,
    },
    unknownChecks: {
      type: Number,
      default: 0,
      min: 0,
    },
    burnRates: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    exhaustionForecast: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    alertEvents: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
    idempotencyKey: {
      type: String,
      unique: true,
      sparse: true,
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

// Compound indexes for bounded, performant query patterns
sloSnapshotSchema.index({ slo: 1, evaluatedAt: -1 });
sloSnapshotSchema.index({ monitor: 1, evaluatedAt: -1 });
sloSnapshotSchema.index({ owner: 1, evaluatedAt: -1 });
sloSnapshotSchema.index({ slo: 1, windowEnd: 1 });

const SloSnapshot = mongoose.model("SloSnapshot", sloSnapshotSchema);

export default SloSnapshot;
