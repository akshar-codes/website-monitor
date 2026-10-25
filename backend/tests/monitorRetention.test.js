import test from "node:test";
import assert from "node:assert/strict";
import { runRetentionPass } from "../src/workers/retentionManager.js";
import { pruneMonitorResponseSnapshots } from "../src/services/healthResponseRetention.service.js";

const query = (rows) => ({
  select() {
    return this;
  },
  sort() {
    return this;
  },
  limit() {
    return this;
  },
  lean: async () => rows,
});

test("retention deletes only old checks not referenced by incidents and preserves aggregates", async () => {
  const ids = ["old-a", "old-b", "old-c"];
  let deletion;
  const HealthCheck = {
    find(filter) {
      if (filter.diagnostics) return query([]);
      assert.ok(filter.checkedAt.$lt instanceof Date);
      return query(ids.map((_id) => ({ _id })));
    },
    async aggregate() {
      return [];
    },
    async deleteMany(filter) {
      deletion = filter;
      return { deletedCount: filter._id.$in.length };
    },
  };
  const Incident = {
    find(filter) {
      assert.equal(filter.$or.length, 2);
      return query([{ triggerCheck: "old-a", recoveryCheck: "old-b" }]);
    },
  };
  const result = await runRetentionPass({
    HealthCheck,
    Incident,
    DailyStat: { find: () => query([]) },
    batchSize: 3,
    now: new Date("2026-10-22T00:00:00Z"),
  });
  assert.deepEqual(deletion._id.$in, ["old-c"]);
  assert.equal(result.checksDeleted, 1);
  assert.equal(result.checksProtected, 2);
});

test("retention redacts diagnostics in a bounded batch without deleting checks", async () => {
  let redactedIds;
  const HealthCheck = {
    find(filter) {
      if (filter.diagnostics) return query([{ _id: "diagnostic-1" }]);
      return query([]);
    },
    async aggregate() {
      return [];
    },
    async updateMany(filter, update) {
      redactedIds = filter._id.$in;
      assert.deepEqual(Object.keys(update.$unset), ["diagnostics"]);
    },
    async deleteMany() {
      throw new Error("no check candidates expected");
    },
  };
  const result = await runRetentionPass({
    HealthCheck,
    Incident: {},
    DailyStat: { find: () => query([]) },
    batchSize: 1,
    now: new Date("2026-10-22T00:00:00Z"),
  });
  assert.deepEqual(redactedIds, ["diagnostic-1"]);
  assert.equal(result.diagnosticsRedacted, 1);
  assert.equal(result.checksDeleted, 0);
});

test("retention deletes expired daily aggregates in a bounded batch", async () => {
  let deletedIds;
  const HealthCheck = {
    find(filter) {
      if (filter.diagnostics) return query([]);
      return query([]);
    },
    async aggregate() {
      return [];
    },
  };
  const DailyStat = {
    find(filter) {
      assert.ok(filter.date.$lt instanceof Date);
      return query([{ _id: "stat-1" }, { _id: "stat-2" }]);
    },
    async deleteMany(filter) {
      deletedIds = filter._id.$in;
      return { deletedCount: deletedIds.length };
    },
  };

  const result = await runRetentionPass({
    HealthCheck,
    Incident: {},
    DailyStat,
    batchSize: 2,
    now: new Date("2026-10-22T00:00:00Z"),
  });

  assert.deepEqual(deletedIds, ["stat-1", "stat-2"]);
  assert.equal(result.dailyStatsDeleted, 2);
});

test("response history pruning keeps the ten newest snapshots per monitor", async () => {
  let updateFilter;
  const kept = Array.from({ length: 10 }, (_, index) => ({
    _id: `check-${index}`,
    checkedAt: new Date(10 - index),
  }));
  const HealthCheck = {
    find(filter) {
      assert.equal(String(filter.monitor), "monitor-1");
      return query(kept);
    },
    async updateMany(filter, update) {
      updateFilter = filter;
      assert.deepEqual(update, { $unset: { rawResponse: 1 } });
      return { modifiedCount: 3 };
    },
  };

  const pruned = await pruneMonitorResponseSnapshots("monitor-1", HealthCheck);
  assert.equal(pruned, 3);
  assert.equal(updateFilter.$or.length, 2);
  assert.equal(updateFilter.$or[0].checkedAt.$lt, kept.at(-1).checkedAt);
});
