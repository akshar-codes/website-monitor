import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    agentId: { type: String, required: true, unique: true },
    regionId: { type: String, required: true },
    lastHeartbeatAt: { type: Date, required: true },
    status: { type: String, enum: ["active", "offline"], default: "active" },
    version: { type: String, default: null },
  },
  { timestamps: true },
);

schema.index({ regionId: 1, status: 1, lastHeartbeatAt: -1 });
export default mongoose.model("ProbeAgent", schema);
