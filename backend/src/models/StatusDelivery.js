import mongoose from "mongoose";
const schema = new mongoose.Schema(
  {
    statusPage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StatusPage",
      required: true,
    },
    subscriber: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StatusSubscriber",
      required: true,
    },
    recipient: { type: String, required: true, select: false },
    eventType: { type: String, required: true },
    subject: { type: String, required: true, maxlength: 200 },
    message: { type: String, required: true, maxlength: 4000 },
    pageSlug: { type: String, required: true },
    idempotencyKey: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "processing", "sent", "failed", "cancelled"],
      default: "pending",
    },
    attempts: { type: Number, default: 0 },
    nextAttemptAt: { type: Date, default: Date.now },
    leaseUntil: { type: Date, default: null },
    sentAt: { type: Date, default: null },
    lastError: { type: String, default: "", maxlength: 500 },
  },
  { timestamps: true },
);
schema.index({ idempotencyKey: 1 }, { unique: true });
schema.index({ status: 1, nextAttemptAt: 1 });
export default mongoose.model("StatusDelivery", schema);
