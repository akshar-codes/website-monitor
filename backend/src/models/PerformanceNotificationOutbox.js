import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    eventKey: { type: String, required: true, unique: true },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    monitor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Monitor",
      required: true,
    },
    type: {
      type: String,
      enum: ["performance_degraded", "performance_recovered"],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    priority: { type: String, default: "normal" },
    link: { type: String, default: null },
    relatedResource: { type: mongoose.Schema.Types.Mixed, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: null },
    status: {
      type: String,
      enum: ["pending", "processing", "sent", "skipped"],
      default: "pending",
    },
    attempts: { type: Number, default: 0 },
    nextAttemptAt: { type: Date, default: Date.now },
    lockedUntil: { type: Date, default: null },
    lastError: { type: String, default: null },
    sentAt: { type: Date, default: null },
  },
  { timestamps: true },
);

schema.index({ status: 1, nextAttemptAt: 1, createdAt: 1 });

export default mongoose.model("PerformanceNotificationOutbox", schema);
