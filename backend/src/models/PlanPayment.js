import mongoose from "mongoose";
import { PLAN_VALUES } from "../config/constants.js";

const schema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    upgradeRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PlanUpgradeRequest",
      default: null,
    },
    plan: { type: String, enum: PLAN_VALUES, required: true },
    period: { type: String, enum: ["monthly", "yearly"], required: true },
    amount: { type: Number, required: true },
    discountPercent: { type: Number, min: 0, max: 100, default: 0 },
    expiresAt: { type: Date, default: null },
    currency: { type: String, enum: ["INR"], required: true },
    orderId: { type: String, required: true, unique: true },
    paymentId: { type: String, default: null },
    status: {
      type: String,
      enum: ["created", "processing", "paid", "failed"],
      default: "created",
      index: true,
    },
    paidAt: { type: Date, default: null },
  },
  { timestamps: true },
);

schema.index(
  { paymentId: 1 },
  { unique: true, partialFilterExpression: { paymentId: { $type: "string" } } },
);
export default mongoose.model("PlanPayment", schema);
