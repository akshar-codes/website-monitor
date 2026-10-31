import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    agentId: { type: String, required: true },
    nonce: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

schema.index({ agentId: 1, nonce: 1 }, { unique: true });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export default mongoose.model("ProbeRequestNonce", schema);
