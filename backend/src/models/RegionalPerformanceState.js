import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    monitor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Monitor",
      required: true,
    },
    regionId: { type: String, required: true },
    status: { type: String, enum: ["normal", "degraded"], default: "normal" },
    baselineSamples: { type: [Number], default: [] },
    recentSamples: { type: [Number], default: [] },
    baselineMedianMs: { type: Number, default: null },
    baselineMadMs: { type: Number, default: null },
    consecutiveBreaches: { type: Number, default: 0 },
    consecutiveRecoveries: { type: Number, default: 0 },
    lastEvaluatedCheck: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RegionalCheck",
      default: null,
    },
    lastAlertAt: { type: Date, default: null },
  },
  { timestamps: true },
);

schema.index({ monitor: 1, regionId: 1 }, { unique: true });
export default mongoose.model("RegionalPerformanceState", schema);
