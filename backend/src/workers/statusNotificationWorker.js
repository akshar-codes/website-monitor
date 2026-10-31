import StatusDelivery from "../models/StatusDelivery.js";
import StatusSubscriber from "../models/StatusSubscriber.js";
import StatusMaintenance from "../models/StatusMaintenance.js";
import StatusPage from "../models/StatusPage.js";
import { sendStatusSubscriberEmail } from "../services/email.service.js";
import {
  makeUnsubscribeToken,
  tokenHash,
} from "../services/statusNotification.service.js";
import env from "../config/env.js";
import logger from "../utils/logger.js";
import { enqueueBestEffort } from "../services/statusNotification.service.js";

let timer = null;
let running = false;
const MAX_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 30_000;

async function deliverBatch() {
  if (running) return;
  running = true;
  try {
    await updateMaintenanceStates();
    for (let index = 0; index < 20; index++) {
      const now = new Date();
      const job = await StatusDelivery.findOneAndUpdate(
        {
          $or: [
            { status: "pending", nextAttemptAt: { $lte: now } },
            { status: "processing", leaseUntil: { $lte: now } },
          ],
        },
        {
          $set: {
            status: "processing",
            leaseUntil: new Date(now.getTime() + 60_000),
          },
          $inc: { attempts: 1 },
        },
        { sort: { createdAt: 1 }, new: true },
      ).select("+recipient");
      if (!job) break;
      try {
        const statusPage = await StatusPage.findOne({
          _id: job.statusPage,
          isPublished: true,
        })
          .select("_id")
          .lean();
        if (!statusPage) {
          await job.updateOne({
            $set: {
              status: "cancelled",
              leaseUntil: null,
              lastError: "Status page is unpublished",
            },
          });
          continue;
        }
        const subscriber = await StatusSubscriber.findById(
          job.subscriber,
        ).select("+unsubscribeTokenHash");
        if (!subscriber?.isActive || !subscriber.isVerified) {
          await job.updateOne({
            $set: {
              status: "failed",
              leaseUntil: null,
              lastError: "Subscriber is inactive",
            },
          });
          continue;
        }
        const token = makeUnsubscribeToken(subscriber);
        if (!subscriber.unsubscribeTokenHash) {
          subscriber.unsubscribeTokenHash = tokenHash(token);
          await subscriber.save();
        }
        const statusUrl = `${env.CLIENT_URL}/status/${encodeURIComponent(job.pageSlug)}`;
        const unsubscribeUrl = `${env.CLIENT_URL}/status-subscription#token=${encodeURIComponent(token)}&action=unsubscribe`;
        const preferencesUrl = `${env.CLIENT_URL}/status-subscription#token=${encodeURIComponent(token)}&action=preferences`;
        await sendStatusSubscriberEmail({
          to: job.recipient,
          subject: job.subject,
          message: job.message,
          statusUrl,
          preferencesUrl,
          unsubscribeUrl,
        });
        await job.updateOne({
          $set: {
            status: "sent",
            sentAt: new Date(),
            leaseUntil: null,
            lastError: "",
          },
        });
      } catch (error) {
        const failed = job.attempts >= MAX_ATTEMPTS;
        const backoff = Math.min(
          6 * 60 * 60_000,
          BASE_BACKOFF_MS * 2 ** Math.max(0, job.attempts - 1),
        );
        const safeError = /^[A-Z0-9_]{1,40}$/.test(error.code || "")
          ? `Email delivery failed (${error.code})`
          : "Email delivery failed";
        await job.updateOne({
          $set: {
            status: failed ? "failed" : "pending",
            nextAttemptAt: new Date(Date.now() + backoff),
            leaseUntil: null,
            lastError: safeError,
          },
        });
        logger.warn(
          `Status notification delivery ${failed ? "failed permanently" : "will retry"}`,
          { deliveryId: String(job._id), attempts: job.attempts },
        );
      }
    }
  } catch (error) {
    logger.error(`Status notification worker failed: ${error.message}`);
  } finally {
    running = false;
  }
}

async function updateMaintenanceStates() {
  const now = new Date();
  for (let i = 0; i < 50; i++) {
    const ended = await StatusMaintenance.findOneAndUpdate(
      {
        status: { $in: ["scheduled", "in_progress"] },
        scheduledEnd: { $lte: now },
      },
      { $set: { status: "completed" } },
      { new: true },
    );
    if (!ended) break;
    if (ended.isPublished)
      await enqueueBestEffort(ended.statusPage, {
        eventType: "maintenance_update",
        eventId: `${ended._id}:completed`,
        subject: `Maintenance completed: ${ended.title}`,
        message:
          ended.description || "The scheduled maintenance window has ended.",
      });
  }
  for (let i = 0; i < 50; i++) {
    const started = await StatusMaintenance.findOneAndUpdate(
      {
        status: "scheduled",
        scheduledStart: { $lte: now },
        scheduledEnd: { $gt: now },
      },
      { $set: { status: "in_progress" } },
      { new: true },
    );
    if (!started) break;
    if (started.isPublished)
      await enqueueBestEffort(started.statusPage, {
        eventType: "maintenance_update",
        eventId: `${started._id}:in_progress`,
        subject: `Maintenance started: ${started.title}`,
        message:
          started.description ||
          "The scheduled maintenance window is now in progress.",
      });
  }
}

export const start = () => {
  if (timer) return;
  timer = setInterval(() => void deliverBatch(), 5000);
  timer.unref?.();
  void deliverBatch();
};
export const stop = async () => {
  if (timer) clearInterval(timer);
  timer = null;
  while (running) await new Promise((resolve) => setTimeout(resolve, 25));
};
