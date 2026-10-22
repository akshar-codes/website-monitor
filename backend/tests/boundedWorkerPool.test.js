import test from "node:test";
import assert from "node:assert/strict";
import { consumeWithConcurrency } from "../src/workers/boundedWorkerPool.js";

async function* jobs(count) {
  for (let index = 0; index < count; index += 1) yield index;
}

test("streamed worker pool bounds active work and continues after a worker error", async () => {
  let active = 0;
  let maximum = 0;
  const completed = [];
  const errors = [];
  const count = await consumeWithConcurrency(
    jobs(250),
    4,
    async (id) => {
      active += 1;
      maximum = Math.max(maximum, active);
      await new Promise((resolve) => setTimeout(resolve, id % 3));
      active -= 1;
      if (id === 17) throw new Error("simulated endpoint failure");
      completed.push(id);
    },
    (error, id) => errors.push({ message: error.message, id }),
  );

  assert.equal(maximum, 4);
  assert.equal(count, 249);
  assert.equal(completed.length, 249);
  assert.deepEqual(errors, [{ message: "simulated endpoint failure", id: 17 }]);
});
