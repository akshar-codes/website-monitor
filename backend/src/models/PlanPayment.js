import mongoose from "mongoose";
import { PLAN_VALUES } from "../config/constants.js";

const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  plan: { type: String, enum: PLAN_VALUES, required: true },
  period: { type: String, enum: ["monthly", "yearly"], required: true },
  amount: { type: Number, required: true },
  currency: { type: String, enum: ["INR"], required: true },
  orderId: { type: String, required: true, unique: true },
  paymentId: { type: String, default: null },
  status: { type: String, enum: ["created", "processing", "paid", "failed"], default: "created", index: true },
  paidAt: { type: Date, default: null },
}, { timestamps: true });

schema.index({ paymentId: 1 }, { unique: true, partialFilterExpression: { paymentId: { $type: "string" } } });
export default mongoose.model("PlanPayment", schema);
