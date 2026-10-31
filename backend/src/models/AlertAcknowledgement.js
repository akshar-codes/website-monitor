import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    incident: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Incident",
      required: true,
    },
    acknowledgedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    acknowledgedAt: { type: Date, default: Date.now },
    source: { type: String, enum: ["dashboard", "api"], default: "dashboard" },
  },
  { timestamps: true },
);

schema.index({ owner: 1, incident: 1 }, { unique: true });
export default mongoose.model("AlertAcknowledgement", schema);
