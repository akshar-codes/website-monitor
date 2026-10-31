import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    monitor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Monitor",
      required: true,
    },
    runId: { type: String, required: true, unique: true },
    expectedRegions: { type: [String], required: true },
    intervalSeconds: { type: Number, required: true },
    status: {
      type: String,
      enum: ["pending", "finalizing", "finalized"],
      default: "pending",
    },
    scheduledAt: { type: Date, required: true },
    deadlineAt: { type: Date, required: true },
    finalizedAt: { type: Date, default: null },
    finalizingAt: { type: Date, default: null },
    canonicalHealthCheck: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "HealthCheck",
      default: null,
    },
  },
  { timestamps: true },
);

schema.index({ status: 1, deadlineAt: 1 });
export default mongoose.model("RegionalProbeRun", schema);
