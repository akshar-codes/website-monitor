import test from "node:test";
import assert from "node:assert/strict";
import {
  summarizeChecks,
  updateDailyStat,
  reconcileDailyStat,
} from "../src/workers/aggregationManager.js";
import { HEALTH_STATUS } from "../src/config/constants.js";

const monitor = {
  _id: "monitor-daily",
  interval: 300,
  createdAt: new Date("2026-10-20T00:00:00.000Z"),
};

test("daily aggregation uses UTC midnight boundaries and weights measured samples", () => {
  const date = new Date("2026-10-21T19:42:00.000Z");
  const result = summarizeChecks(
    [
      {
        status: HEALTH_STATUS.UP,
        responseTime: 100,
        intervalSeconds: 300,
        scheduled: true,
        checkedAt: new Date("2026-10-21T23:55:00.000Z"),
      },
      {
        status: HEALTH_STATUS.DOWN,
        responseTime: 200,
        intervalSeconds: 300,
        scheduled: true,
        checkedAt: new Date("2026-10-21T23:59:59.999Z"),
      },
    ],
    monitor,
    date,
    new Date("2026-10-22T00:00:00.000Z"),
  );

  assert.equal(result.totalChecks, 2);
  assert.equal(result.successfulChecks, 1);
  assert.equal(result.failedChecks, 1);
  assert.equal(result.uptimePercentage, 50);
  assert.equal(result.expectedChecks, 288);
  assert.equal(result.coveragePercentage, 0.69);
  assert.equal(result.estimatedDowntimeSeconds, 300);
});

test("missing observations are uncovered and never counted as healthy", () => {
  const result = summarizeChecks(
    [],
    monitor,
    new Date("2026-10-21T00:00:00Z"),
    new Date("2026-10-22T00:00:00Z"),
  );
  assert.equal(result.totalChecks, 0);
  assert.equal(result.uptimePercentage, null);
  assert.equal(result.coveragePercentage, 0);
  assert.equal(result.unobservedSeconds, 86400);
});

test("rerunning daily aggregation replaces the bucket instead of double-counting", async () => {
  const date = new Date("2026-10-21T23:59:59Z");
  const checks = [
    {
      status: HEALTH_STATUS.UP,
      responseTime: 80,
      intervalSeconds: 300,
      scheduled: true,
      checkedAt: new Date("2026-10-21T23:55:00Z"),
    },
  ];
  let stored;
  const HealthCheck = {
    find(filter) {
      assert.equal(
        filter.checkedAt.$gte.toISOString(),
        "2026-10-21T00:00:00.000Z",
      );
      assert.equal(
        filter.checkedAt.$lt.toISOString(),
        "2026-10-22T00:00:00.000Z",
      );
      return {
        select() {
          return this;
        },
        sort() {
          return this;
        },
        lean: async () => checks,
      };
    },
  };
  const DailyStat = {
    async findOneAndUpdate(filter, update) {
      assert.equal(filter.date.toISOString(), "2026-10-21T00:00:00.000Z");
      stored = { ...update.$set };
      return stored;
    },
    async deleteOne() {
      throw new Error("should not delete a populated bucket");
    },
  };
  const deps = { HealthCheck, DailyStat };
  await updateDailyStat(monitor, { checkedAt: date }, deps);
  await updateDailyStat(monitor, { checkedAt: date }, deps);
  assert.equal(stored.totalChecks, 1);
  assert.equal(stored.successfulChecks, 1);
  assert.equal(stored.avgResponseTime, 80);
});

test("reconciliation removes stale daily rows after the final check is deleted", async () => {
  let deletedFilter;
  const HealthCheck = {
    find() {
      return {
        select() {
          return this;
        },
        sort() {
          return this;
        },
        lean: async () => [],
      };
    },
  };
  const DailyStat = {
    async deleteOne(filter) {
      deletedFilter = filter;
    },
    async findOneAndUpdate() {
      throw new Error("should not upsert an empty day");
    },
  };
  const result = await reconcileDailyStat(
    monitor,
    new Date("2026-10-21T00:00:00Z"),
    { HealthCheck, DailyStat },
  );
  assert.equal(result, null);
  assert.equal(deletedFilter.date.toISOString(), "2026-10-21T00:00:00.000Z");
});
