import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    monitor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Monitor",
      required: true,
    },
    regionId: { type: String, required: true },
    status: {
      type: String,
      enum: ["confirming", "ongoing", "resolved"],
      default: "confirming",
    },
    consecutiveFailures: { type: Number, default: 0 },
    consecutiveSuccesses: { type: Number, default: 0 },
    startedAt: { type: Date, required: true },
    recoveredAt: { type: Date, default: null },
    lastCheck: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RegionalCheck",
      default: null,
    },
  },
  { timestamps: true },
);

schema.index({ monitor: 1, regionId: 1, status: 1 });
schema.index({ monitor: 1, regionId: 1, startedAt: -1 });
export default mongoose.model("RegionalIncident", schema);
