import mongoose from "mongoose";

const timingsSchema = new mongoose.Schema(
  {
    dnsMs: { type: Number, default: null },
    tcpConnectMs: { type: Number, default: null },
    tlsHandshakeMs: { type: Number, default: null },
    ttfbMs: { type: Number, default: null },
    downloadMs: { type: Number, default: null },
    totalMs: { type: Number, default: null },
  },
  { _id: false },
);

const schema = new mongoose.Schema(
  {
    monitor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Monitor",
      required: true,
    },
    runId: { type: String, required: true },
    regionId: { type: String, required: true },
    jobStatus: {
      type: String,
      enum: ["queued", "leased", "complete", "expired"],
      default: "queued",
    },
    leaseAgentId: { type: String, default: null },
    leaseToken: { type: String, default: null, select: false },
    leaseUntil: { type: Date, default: null },
    attempts: { type: Number, default: 0 },
    healthStatus: {
      type: String,
      enum: ["up", "down", "degraded", "unknown"],
      default: "unknown",
    },
    frontendStatus: { type: String, default: "unknown" },
    backendStatus: { type: String, default: "unknown" },
    databaseStatus: { type: String, default: "unknown" },
    responseTime: { type: Number, default: null },
    timings: { type: timingsSchema, default: () => ({}) },
    httpStatus: { type: Number, default: null },
    failureReason: { type: String, default: null },
    checkedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    aggregatedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

schema.index({ runId: 1, regionId: 1 }, { unique: true });
schema.index({ monitor: 1, regionId: 1, completedAt: -1 });
schema.index({ regionId: 1, jobStatus: 1, leaseUntil: 1 });
export default mongoose.model("RegionalCheck", schema);
