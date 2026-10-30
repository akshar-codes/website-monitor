import mongoose from "mongoose";

const schema = new mongoose.Schema({
  _id: { type: String, default: "global" },
  mode: { type: String, enum: ["request", "payment"], default: "request" },
  currency: { type: String, enum: ["USD", "INR"], default: "USD" },
  prices: { type: mongoose.Schema.Types.Mixed, required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true, versionKey: false });

export default mongoose.model("BillingSettings", schema);
