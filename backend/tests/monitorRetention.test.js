import test from "node:test";
import assert from "node:assert/strict";
import { runRetentionPass } from "../src/workers/retentionManager.js";

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
      if (filter.$or) return query([]);
      assert.ok(filter.checkedAt.$lt instanceof Date);
      return query(ids.map((_id) => ({ _id })));
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
      if (filter.$or) return query([{ _id: "diagnostic-1" }]);
      return query([]);
    },
    async updateMany(filter, update) {
      redactedIds = filter._id.$in;
      assert.deepEqual(Object.keys(update.$unset).sort(), [
        "diagnostics",
        "rawResponse",
      ]);
    },
    async deleteMany() {
      throw new Error("no check candidates expected");
    },
  };
  const result = await runRetentionPass({
    HealthCheck,
    Incident: {},
    batchSize: 1,
    now: new Date("2026-10-22T00:00:00Z"),
  });
  assert.deepEqual(redactedIds, ["diagnostic-1"]);
  assert.equal(result.diagnosticsRedacted, 1);
  assert.equal(result.checksDeleted, 0);
});
