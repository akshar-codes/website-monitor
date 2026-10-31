import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    policy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AlertPolicy",
      required: true,
    },
    incident: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Incident",
      required: true,
    },
    eventId: { type: String, required: true },
    status: {
      type: String,
      enum: [
        "pending",
        "processing",
        "completed",
        "acknowledged",
        "resolved",
        "cancelled",
      ],
      default: "pending",
      index: true,
    },
    startedAt: { type: Date, required: true },
    nextRunAt: { type: Date, required: true, index: true },
    currentStep: { type: Number, default: 0 },
    repeatCount: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
    lastError: { type: String, default: null, maxlength: 300 },
  },
  { timestamps: true },
);

schema.index({ policy: 1, incident: 1 }, { unique: true });
schema.index({ status: 1, nextRunAt: 1, lockedUntil: 1 });
export default mongoose.model("AlertEscalationExecution", schema);
