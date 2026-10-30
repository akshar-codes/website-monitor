import crypto from "node:crypto";
import env from "../config/env.js";
import User from "../models/User.js";
import PlanPayment from "../models/PlanPayment.js";
import PlanUpgradeRequest from "../models/PlanUpgradeRequest.js";
import ApiError from "../utils/ApiError.js";
import { getPlanDefinition } from "../config/plans.js";
import { getBillingSettings } from "./billingSettings.service.js";
import { changeUserPlan } from "./plan.service.js";
import { getChangeType } from "../utils/planUtils.js";

const razorpayRequest = async (path, { method = "GET", body } = {}) => {
  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    method,
    headers: { Authorization: `Basic ${Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString("base64")}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw ApiError.badRequest(data?.error?.description || "Razorpay could not process the payment request.", "RAZORPAY_REQUEST_FAILED");
  return data;
};

export const createPlanOrder = async (user, { plan, period = "monthly" }) => {
  const settings = await getBillingSettings();
  if (settings.mode !== "payment") throw ApiError.badRequest("Direct payments are currently disabled.");
  if (!settings.paymentReady) throw ApiError.badRequest("Razorpay is not configured on the server.");
  if (settings.currency !== "INR") throw ApiError.badRequest("Razorpay checkout requires INR pricing.");
  const definition = getPlanDefinition(plan);
  if (!definition || plan === "free") throw ApiError.badRequest("Choose a paid plan.");
  if (getChangeType(user.plan, plan) !== "upgrade") throw ApiError.badRequest("Checkout is available for plan upgrades only.");
  const amount = settings.prices?.[plan]?.[period];
  if (!Number.isFinite(amount) || amount <= 0) throw ApiError.badRequest("This plan does not have a valid price for the selected period.");
  const amountSubunits = Math.round(amount * 100);
  const order = await razorpayRequest("/orders", { method: "POST", body: {
    amount: amountSubunits, currency: "INR", receipt: `plan_${Date.now()}_${crypto.randomBytes(5).toString("hex")}`,
    notes: { userId: String(user.id || user._id), plan, period },
  } });
  await PlanPayment.create({ user: user.id || user._id, plan, period, amount: amountSubunits, currency: "INR", orderId: order.id });
  return { keyId: settings.publicKeyId, orderId: order.id, amount: amountSubunits, currency: "INR", plan: definition.name, period, customer: { name: user.name, email: user.email } };
};

const signatureMatches = (expected, provided) => {
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(provided || "", "hex");
  return a.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
};

const addPeriod = (from, period) => {
  const date = new Date(from);
  const day = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + (period === "yearly" ? 12 : 1));
  date.setDate(Math.min(day, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()));
  return date;
};

export const verifyPlanPayment = async (user, { orderId, paymentId, signature }) => {
  const userId = user.id || user._id;
  const record = await PlanPayment.findOne({ orderId, user: userId });
  if (!record) throw ApiError.notFound("Payment order not found.");
  if (record.status === "paid") return { paid: true, plan: record.plan };
  const expected = crypto.createHmac("sha256", env.RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest("hex");
  if (!signatureMatches(expected, signature)) throw ApiError.forbidden("Payment signature could not be verified.");
  const providerPayment = await razorpayRequest(`/payments/${encodeURIComponent(paymentId)}`);
  if (providerPayment.order_id !== orderId || providerPayment.amount !== record.amount || providerPayment.currency !== record.currency || providerPayment.status !== "captured") throw ApiError.badRequest("Razorpay has not confirmed a captured payment for this order.");
  const lock = await PlanPayment.findOneAndUpdate({ _id: record._id, status: "created" }, { $set: { status: "processing", paymentId } }, { new: true });
  if (!lock) {
    const latest = await PlanPayment.findById(record._id).lean();
    if (latest?.status === "paid") return { paid: true, plan: latest.plan };
    throw ApiError.conflict("This payment is already being processed.");
  }
  const target = getPlanDefinition(record.plan);
  const expiresAt = addPeriod(new Date(), record.period);
  try {
    await changeUserPlan(userId, record.plan, user, { reason: `Razorpay payment ${paymentId} (${record.period})`, expiresAt, paidVerified: true });
    await PlanPayment.updateOne({ _id: record._id, status: "processing" }, { $set: { status: "paid", paidAt: new Date(), paymentId } });
    await PlanUpgradeRequest.updateMany({ user: userId, status: "pending" }, { $set: { status: "rejected", rejectionReason: "A direct plan payment was completed.", reviewedAt: new Date() } }).catch(() => {});
    return { paid: true, plan: record.plan, planName: target.name, expiresAt };
  } catch (error) {
    const current = await User.findById(userId).select("plan").lean().catch(() => null);
    if (current?.plan === record.plan) {
      await PlanPayment.updateOne({ _id: record._id, status: "processing" }, { $set: { status: "paid", paidAt: new Date(), paymentId } });
      return { paid: true, plan: record.plan, planName: target.name };
    }
    await PlanPayment.updateOne({ _id: record._id, status: "processing" }, { $set: { status: "created" }, $unset: { paymentId: 1 } });
    throw error;
  }
};
