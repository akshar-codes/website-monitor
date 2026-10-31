import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    monitor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Monitor",
      required: true,
    },
    regionId: { type: String, required: true },
    date: { type: Date, required: true },
    totalChecks: { type: Number, default: 0 },
    successfulChecks: { type: Number, default: 0 },
    failedChecks: { type: Number, default: 0 },
    degradedChecks: { type: Number, default: 0 },
    responseTimeSum: { type: Number, default: 0 },
    responseTimeCount: { type: Number, default: 0 },
    appliedRunIds: { type: [String], default: [] },
    latencyHistograms: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({ version: 2 }),
    },
  },
  { timestamps: true },
);

schema.index({ monitor: 1, regionId: 1, date: 1 }, { unique: true });
export default mongoose.model("RegionalDailyStat", schema);
