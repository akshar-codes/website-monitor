import mongoose from "mongoose";

const hourlyStatSchema = new mongoose.Schema(
  {
    monitor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Monitor",
      required: true,
    },
    date: { type: Date, required: true },
    totalChecks: { type: Number, default: 0 },
    scheduledChecks: { type: Number, default: 0 },
    successfulChecks: { type: Number, default: 0 },
    failedChecks: { type: Number, default: 0 },
    degradedChecks: { type: Number, default: 0 },
    unknownChecks: { type: Number, default: 0 },
    frontendUpChecks: { type: Number, default: 0 },
    backendUpChecks: { type: Number, default: 0 },
    databaseUpChecks: { type: Number, default: 0 },
    uptimePercentage: { type: Number, default: null },
    avgResponseTime: { type: Number, default: 0 },
    minResponseTime: { type: Number, default: 0 },
    maxResponseTime: { type: Number, default: 0 },
    downtimeSeconds: { type: Number, default: 0 },
    estimatedDowntimeSeconds: { type: Number, default: 0 },
    estimatedDegradedSeconds: { type: Number, default: 0 },
    degradedSeconds: { type: Number, default: 0 },
    expectedChecks: { type: Number, default: 0 },
    coveragePercentage: { type: Number, default: 0 },
    unobservedSeconds: { type: Number, default: 0 },
    lastCheckAt: { type: Date, default: null },
    _responseTimeSum: { type: Number, default: 0 },
    _observedSeconds: { type: Number, default: 0 },
    responseTimeBuckets: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

hourlyStatSchema.index({ monitor: 1, date: -1 }, { unique: true });
hourlyStatSchema.index({ date: -1 });

export default mongoose.model("HourlyStat", hourlyStatSchema);
