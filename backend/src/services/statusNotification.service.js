import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import env from "../config/env.js";
import StatusSubscriber from "../models/StatusSubscriber.js";
import StatusDelivery from "../models/StatusDelivery.js";
import StatusPage from "../models/StatusPage.js";
import logger from "../utils/logger.js";

export const tokenHash = (token) =>
  createHash("sha256").update(token).digest("hex");
export const deliveryRetry = (attempts, code = "") => ({
  terminal: attempts >= 5,
  nextAttemptAt: new Date(
    Date.now() +
      Math.min(6 * 60 * 60_000, 30_000 * 2 ** Math.max(0, attempts - 1)),
  ),
  safeError: /^[A-Z0-9_]{1,40}$/.test(code)
    ? `Email delivery failed (${code})`
    : "Email delivery failed",
});
const unsubscribeSecret = env.COOKIE_SECRET;

export const makeUnsubscribeToken = (subscriber) => {
  const id = String(subscriber._id);
  const issued = new Date(subscriber.createdAt).getTime().toString(36);
  const payload = `${id}.${issued}`;
  const signature = createHmac("sha256", unsubscribeSecret)
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
};

export const verifyUnsubscribeToken = async (token) => {
  const [id, issued, signature, extra] = String(token || "").split(".");
  if (!id || !issued || !signature || extra || !/^[a-f\d]{24}$/i.test(id))
    return null;
  const payload = `${id}.${issued}`;
  const expected = createHmac("sha256", unsubscribeSecret)
    .update(payload)
    .digest();
  let actual;
  try {
    actual = Buffer.from(signature, "base64url");
  } catch {
    return null;
  }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    return null;
  const subscriber = await StatusSubscriber.findById(id).select(
    "+unsubscribeTokenHash",
  );
  if (
    !subscriber ||
    new Date(subscriber.createdAt).getTime().toString(36) !== issued ||
    !subscriber.unsubscribeTokenHash
  )
    return null;
  const storedHash = Buffer.from(subscriber.unsubscribeTokenHash, "hex");
  const candidateHash = createHash("sha256").update(token).digest();
  if (
    storedHash.length !== candidateHash.length ||
    !timingSafeEqual(storedHash, candidateHash)
  )
    return null;
  return subscriber;
};

export async function readSubscriberPreferences(token) {
  const subscriber = await verifyUnsubscribeToken(token);
  if (!subscriber?.isActive || !subscriber.isVerified) return null;
  return { ...subscriber.preferences };
}

export async function updateSubscriberPreferences(token, preferences) {
  const subscriber = await verifyUnsubscribeToken(token);
  if (!subscriber?.isActive || !subscriber.isVerified) return false;
  subscriber.preferences = { ...subscriber.preferences, ...preferences };
  await subscriber.save();
  return true;
}

export async function enqueueStatusEvent(
  pageId,
  { eventType, subject, message, eventId },
) {
  const page = await StatusPage.findById(pageId)
    .select("slug isPublished")
    .lean();
  if (!page?.isPublished) return 0;
  const matchPreference = eventType.startsWith("incident")
    ? "incidents"
    : "maintenance";
  const subscribers = await StatusSubscriber.find({
    statusPage: pageId,
    isVerified: true,
    isActive: true,
    [`preferences.${matchPreference}`]: true,
  });
  const operations = subscribers
    .filter(
      (subscriber) =>
        eventType !== "incident_update" ||
        subscriber.preferences.incidentUpdates,
    )
    .map((subscriber) => ({
      updateOne: {
        filter: { idempotencyKey: `${eventId}:${eventType}:${subscriber._id}` },
        update: {
          $setOnInsert: {
            statusPage: pageId,
            subscriber: subscriber._id,
            recipient: subscriber.email,
            eventType,
            subject,
            message,
            pageSlug: page.slug,
            idempotencyKey: `${eventId}:${eventType}:${subscriber._id}`,
          },
        },
        upsert: true,
      },
    }));
  if (!operations.length) return 0;
  try {
    const result = await StatusDelivery.bulkWrite(operations, {
      ordered: false,
    });
    return result.upsertedCount || 0;
  } catch (error) {
    const writeErrors =
      error.writeErrors || error.result?.getWriteErrors?.() || [];
    if (!writeErrors.length || writeErrors.some((item) => item.code !== 11000))
      throw error;
    return 0;
  }
}

export async function enqueueBestEffort(pageId, event) {
  try {
    await enqueueStatusEvent(pageId, event);
  } catch (error) {
    logger.error(`Status notification enqueue failed: ${error.message}`);
  }
}
