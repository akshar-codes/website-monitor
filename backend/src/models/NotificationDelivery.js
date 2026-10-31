import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    integration: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "NotificationIntegration",
      required: true,
    },
    eventId: { type: String, required: true },
    eventType: { type: String, required: true },
    idempotencyKey: { type: String, required: true, unique: true },
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
    status: {
      type: String,
      enum: [
        "pending",
        "processing",
        "delivered",
        "failed",
        "dead_letter",
        "cancelled",
      ],
      default: "pending",
      index: true,
    },
    attempts: { type: Number, default: 0 },
    nextRetryAt: { type: Date, default: Date.now, index: true },
    lockedUntil: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    lastAttemptAt: { type: Date, default: null },
    error: { type: String, default: null, maxlength: 300 },
    responseStatus: { type: Number, default: null },
  },
  { timestamps: true },
);

schema.index({ owner: 1, createdAt: -1 });
schema.index({ status: 1, nextRetryAt: 1, lockedUntil: 1 });
export default mongoose.model("NotificationDelivery", schema);
