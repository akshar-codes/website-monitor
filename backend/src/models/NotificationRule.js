import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    integrationIds: [
      { type: mongoose.Schema.Types.ObjectId, ref: "NotificationIntegration" },
    ],
    events: [{ type: String, required: true }],
    filters: {
      monitorIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Monitor" }],
      severity: [{ type: String, enum: ["critical", "high", "normal", "low"] }],
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

schema.index({ owner: 1, isActive: 1 });
export default mongoose.model("NotificationRule", schema);
