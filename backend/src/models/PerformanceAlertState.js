import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    monitor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Monitor",
      required: true,
    },
    metric: { type: String, enum: ["responseTime"], default: "responseTime" },
    status: { type: String, enum: ["normal", "degraded"], default: "normal" },
    baselineMedianMs: { type: Number, default: null },
    baselineMadMs: { type: Number, default: null },
    baselineUrl: { type: String, default: null },
    baselineStartedAt: { type: Date, default: null },
    baselineSamples: { type: [Number], default: [] },
    recentSamples: { type: [Number], default: [] },
    consecutiveBreaches: { type: Number, default: 0 },
    consecutiveRecoveries: { type: Number, default: 0 },
    lastEvaluatedCheckId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "HealthCheck",
      default: null,
    },
    lastAlertAt: { type: Date, default: null },
    lastNotifiedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
schema.index({ monitor: 1, metric: 1 }, { unique: true });
export default mongoose.model("PerformanceAlertState", schema);
