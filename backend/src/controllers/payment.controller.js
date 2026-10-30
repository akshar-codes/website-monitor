import crypto from "node:crypto";
import asyncHandler from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { createPlanOrder, verifyPlanPayment } from "../services/razorpay.service.js";
import env from "../config/env.js";
import PlanPayment from "../models/PlanPayment.js";
import User from "../models/User.js";

export const createOrder = asyncHandler(async (req, res) => sendSuccess(res, { data: await createPlanOrder(req.user, req.body) }));
export const verifyPayment = asyncHandler(async (req, res) => sendSuccess(res, { message: "Payment verified and your plan is active.", data: await verifyPlanPayment(req.user, req.body) }));

export const razorpayWebhook = asyncHandler(async (req, res) => {
  if (!env.RAZORPAY_WEBHOOK_SECRET || !env.RAZORPAY_KEY_SECRET || !req.rawBody) return res.status(503).json({ message: "Razorpay webhook is not configured." });
  const signature = req.get("x-razorpay-signature") || "";
  const expected = crypto.createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET).update(req.rawBody).digest("hex");
  const left = Buffer.from(expected, "hex");
  const right = Buffer.from(signature, "hex");
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) return res.status(400).json({ message: "Invalid webhook signature." });
  const payment = req.body?.payload?.payment?.entity;
  if (req.body?.event === "payment.captured" && payment?.order_id && payment?.id) {
    const record = await PlanPayment.findOne({ orderId: payment.order_id }).lean();
    if (record && record.status !== "paid") {
      const user = await User.findById(record.user);
      if (user) {
        const signatureForOrder = crypto.createHmac("sha256", env.RAZORPAY_KEY_SECRET).update(`${payment.order_id}|${payment.id}`).digest("hex");
        await verifyPlanPayment(user, { orderId: payment.order_id, paymentId: payment.id, signature: signatureForOrder });
      }
    }
  }
  return res.status(200).json({ received: true });
});
