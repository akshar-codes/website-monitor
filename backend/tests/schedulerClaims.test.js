import test from "node:test";
import assert from "node:assert/strict";
import { claimNextDueMonitor } from "../src/workers/scheduler.js";

test("startup recovery can reclaim unleased, missing-lease, and expired-lease jobs atomically", async () => {
  let captured;
  const monitor = { _id: "monitor-1" };
  const Monitor = {
    findOneAndUpdate(filter, update, options) {
      captured = { filter, update, options };
      return Promise.resolve(monitor);
    },
  };
  const now = new Date("2026-10-22T00:00:00Z");
  const result = await claimNextDueMonitor({
    Monitor,
    now,
    token: "lease-token",
  });

  assert.equal(result.monitor, monitor);
  assert.equal(result.token, "lease-token");
  assert.equal(captured.filter.active, true);
  assert.equal(captured.filter.nextCheckAt.$lte, now);
  assert.deepEqual(captured.filter.$and[0].$or, [
    { checkLeaseUntil: null },
    { checkLeaseUntil: { $exists: false } },
    { checkLeaseUntil: { $lte: now } },
  ]);
  assert.equal(captured.update.$set.checkLeaseToken, "lease-token");
  assert.deepEqual(captured.options.sort, { nextCheckAt: 1, _id: 1 });
});

test("scheduler claim database errors propagate to the retrying dispatcher", async () => {
  const expected = new Error("simulated database outage");
  const Monitor = {
    findOneAndUpdate: async () => {
      throw expected;
    },
  };
  await assert.rejects(
    claimNextDueMonitor({ Monitor, now: new Date(), token: "lease-token" }),
    expected,
  );
});

test("competing application instances can claim one due monitor only once", async () => {
  let claimed = false;
  const monitor = { _id: "shared-monitor" };
  const Monitor = {
    findOneAndUpdate() {
      if (claimed) return Promise.resolve(null);
      claimed = true;
      return Promise.resolve(monitor);
    },
  };
  const claims = await Promise.all(
    Array.from({ length: 8 }, (_, index) =>
      claimNextDueMonitor({ Monitor, token: `instance-${index}` }),
    ),
  );
  assert.equal(claims.filter(Boolean).length, 1);
});
