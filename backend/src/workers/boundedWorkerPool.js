/** Consume an async iterable without materializing it or retaining all jobs. */
export const consumeWithConcurrency = async (
  iterable,
  concurrency,
  worker,
  onError = () => {},
) => {
  const limit = Math.max(1, Math.floor(concurrency));
  const pending = new Set();
  let completed = 0;
  for await (const item of iterable) {
    let task;
    task = Promise.resolve()
      .then(() => worker(item))
      .then(() => {
        completed += 1;
      })
      .catch((error) => onError(error, item))
      .finally(() => pending.delete(task));
    pending.add(task);
    if (pending.size >= limit) await Promise.race(pending);
  }
  await Promise.all(pending);
  return completed;
};
