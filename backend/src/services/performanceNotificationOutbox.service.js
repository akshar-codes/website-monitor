import PerformanceNotificationOutbox from "../models/PerformanceNotificationOutbox.js";
import { createNotification } from "./notification.service.js";
import logger from "../utils/logger.js";

let timer = null;
let running = false;

export const enqueuePerformanceNotification = async (payload, deps = {}) => {
  const Outbox = deps.Outbox || PerformanceNotificationOutbox;
  const monitor = payload.monitor;
  return Outbox.updateOne(
    { eventKey: payload.eventKey },
    {
      $setOnInsert: {
        eventKey: payload.eventKey,
        owner: monitor.owner,
        monitor: monitor._id,
        type: payload.type,
        title: payload.title,
        message: payload.message,
        priority: payload.priority,
        link: payload.link,
        relatedResource: payload.relatedResource,
        metadata: payload.metadata,
      },
    },
    { upsert: true },
  );
};

export const deliverPerformanceNotificationBatch = async (deps = {}) => {
  const Outbox = deps.Outbox || PerformanceNotificationOutbox;
  const Notify = deps.createNotification || createNotification;
  const now = deps.now || new Date();
  const batchSize = deps.batchSize || 50;
  let sent = 0;
  let failed = 0;

  for (let index = 0; index < batchSize; index += 1) {
    const row = await Outbox.findOneAndUpdate(
      {
        $or: [
          { status: "pending", nextAttemptAt: { $lte: now } },
          { status: "processing", lockedUntil: { $lte: now } },
        ],
      },
      {
        $set: {
          status: "processing",
          lockedUntil: new Date(now.getTime() + 60_000),
        },
        $inc: { attempts: 1 },
      },
      { sort: { createdAt: 1 }, returnDocument: "after" },
    );
    if (!row) break;
    try {
      const notification = await Notify({
        ownerId: row.owner,
        type: row.type,
        title: row.title,
        message: row.message,
        priority: row.priority,
        link: row.link,
        relatedResource: row.relatedResource,
        metadata: row.metadata,
        dedupeKey: row.eventKey,
        throwOnError: true,
      });
      await Outbox.updateOne(
        { _id: row._id, status: "processing" },
        {
          $set: {
            status: notification ? "sent" : "skipped",
            sentAt: notification ? now : null,
            lockedUntil: null,
            lastError: null,
          },
        },
      );
      if (notification) sent += 1;
    } catch (error) {
      const attempts = row.attempts || 1;
      const delayMs = Math.min(
        60 * 60_000,
        5_000 * 2 ** Math.min(attempts - 1, 10),
      );
      await Outbox.updateOne(
        { _id: row._id, status: "processing" },
        {
          $set: {
            status: "pending",
            nextAttemptAt: new Date(now.getTime() + delayMs),
            lockedUntil: null,
            lastError: String(
              error.message || "Notification delivery failed",
            ).slice(0, 300),
          },
        },
      );
      failed += 1;
    }
  }
  return { sent, failed };
};

export const startPerformanceNotificationWorker = () => {
  if (timer) return;
  timer = setInterval(() => {
    if (running) return;
    running = true;
    void deliverPerformanceNotificationBatch()
      .catch((error) =>
        logger.error("Performance notification worker failed", {
          error: error.message,
        }),
      )
      .finally(() => {
        running = false;
      });
  }, 5_000);
  timer.unref?.();
};

export const stopPerformanceNotificationWorker = async () => {
  if (timer) clearInterval(timer);
  timer = null;
  while (running) await new Promise((resolve) => setTimeout(resolve, 25));
};
