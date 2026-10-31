import test from "node:test";
import assert from "node:assert/strict";
import { deliverPerformanceNotificationBatch } from "../src/services/performanceNotificationOutbox.service.js";

test("outbox keeps failed performance notifications pending for retry", async () => {
  const now = new Date("2026-10-31T00:00:00Z");
  const row = {
    _id: "outbox-1",
    owner: "owner-1",
    type: "performance_degraded",
    attempts: 1,
  };
  let claimed = false;
  let update;
  const result = await deliverPerformanceNotificationBatch({
    now,
    Outbox: {
      findOneAndUpdate: async () => {
        if (claimed) return null;
        claimed = true;
        return row;
      },
      updateOne: async (_filter, fields) => {
        update = fields;
      },
    },
    createNotification: async () => {
      throw new Error("temporary store failure");
    },
  });

  assert.deepEqual(result, { sent: 0, failed: 1 });
  assert.equal(update.$set.status, "pending");
  assert.equal(update.$set.nextAttemptAt.getTime(), now.getTime() + 5_000);
  assert.match(update.$set.lastError, /temporary store failure/);
});

test("outbox uses a stable event key and marks preference-disabled notices skipped", async () => {
  const row = {
    _id: "outbox-2",
    owner: "owner-1",
    type: "performance_recovered",
    eventKey: "monitor:recovered:check-2",
    attempts: 1,
  };
  let update;
  let notificationInput;
  let claimed = false;
  const result = await deliverPerformanceNotificationBatch({
    Outbox: {
      findOneAndUpdate: async () => {
        if (claimed) return null;
        claimed = true;
        return row;
      },
      updateOne: async (_filter, fields) => {
        update = fields;
      },
    },
    createNotification: async (input) => {
      notificationInput = input;
      return null;
    },
  });

  assert.deepEqual(result, { sent: 0, failed: 0 });
  assert.equal(notificationInput.dedupeKey, row.eventKey);
  assert.equal(update.$set.status, "skipped");
});
