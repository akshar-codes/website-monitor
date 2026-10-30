import mongoose from "mongoose";
import BillingSettings from "../models/BillingSettings.js";
import { PLAN_DEFINITIONS } from "../config/plans.js";
import ApiError from "../utils/ApiError.js";
import env from "../config/env.js";

const defaults = () => Object.fromEntries(Object.entries(PLAN_DEFINITIONS).map(([id, p]) => [id, { monthly: p.price.monthly, yearly: p.price.yearly }]));
export const isRazorpayConfigured = () => Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);

export const getBillingSettings = async () => {
  if (mongoose.connection.readyState !== 1) {
    return {
      mode: "request",
      currency: "USD",
      prices: defaults(),
      paymentReady: isRazorpayConfigured(),
      webhookReady: Boolean(env.RAZORPAY_WEBHOOK_SECRET),
      publicKeyId: isRazorpayConfigured() ? env.RAZORPAY_KEY_ID : null,
    };
  }
  const stored = await BillingSettings.findById("global").lean();
  return {
    mode: stored?.mode || "request",
    currency: stored?.currency || "USD",
    prices: { ...defaults(), ...(stored?.prices || {}) },
    paymentReady: isRazorpayConfigured(),
    webhookReady: Boolean(env.RAZORPAY_WEBHOOK_SECRET),
    publicKeyId: isRazorpayConfigured() ? env.RAZORPAY_KEY_ID : null,
  };
};

export const saveBillingSettings = async ({ mode, currency, prices }, actor) => {
  if (mode === "payment" && !isRazorpayConfigured()) throw ApiError.badRequest("Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to the backend environment before enabling payments.");
  if (mode === "payment" && currency !== "INR") throw ApiError.badRequest("Razorpay checkout requires INR pricing for this store.");
  const merged = defaults();
  for (const id of Object.keys(merged)) {
    merged[id] = { monthly: prices?.[id]?.monthly ?? merged[id].monthly, yearly: prices?.[id]?.yearly ?? merged[id].yearly };
    for (const period of ["monthly", "yearly"]) if (!Number.isFinite(merged[id][period]) || merged[id][period] < 0 || merged[id][period] > 10000000) throw ApiError.badRequest(`Invalid ${period} price for ${id}.`);
  }
  merged.free = { monthly: 0, yearly: 0 };
  if (mode === "payment" && ["pro", "unlimited"].some((id) => merged[id].monthly <= 0 || merged[id].yearly <= 0)) throw ApiError.badRequest("Paid plans need a price above zero for both monthly and yearly checkout.");
  const saved = await BillingSettings.findByIdAndUpdate("global", { $set: { mode, currency, prices: merged, updatedBy: actor.id || actor._id } }, { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }).lean();
  return { ...saved, paymentReady: isRazorpayConfigured(), webhookReady: Boolean(env.RAZORPAY_WEBHOOK_SECRET), publicKeyId: isRazorpayConfigured() ? env.RAZORPAY_KEY_ID : null };
};

export const getPricedPlanCatalog = async () => {
  const settings = await getBillingSettings();
  return Object.values(PLAN_DEFINITIONS).sort((a, b) => a.rank - b.rank).map((p) => ({ ...p, price: { ...settings.prices[p.id], currency: settings.currency } }));
};
