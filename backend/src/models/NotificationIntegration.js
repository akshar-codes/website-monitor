import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    provider: {
      type: String,
      enum: ["slack", "discord", "telegram", "webhook"],
      required: true,
    },
    config: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    credentials: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
      select: false,
    },
    isActive: { type: Boolean, default: true },
    lastTestedAt: { type: Date, default: null },
    lastSuccessAt: { type: Date, default: null },
    lastError: { type: String, default: null, maxlength: 300 },
  },
  { timestamps: true },
);

schema.index({ owner: 1, createdAt: -1 });
export default mongoose.model("NotificationIntegration", schema);
