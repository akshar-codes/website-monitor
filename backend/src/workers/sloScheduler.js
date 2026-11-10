import { randomUUID } from "node:crypto";
import Slo from "../models/SLO.js";
import env from "../config/env.js";
import logger from "../utils/logger.js";
import { evaluateSlo } from "../services/sloEvaluation.service.js";

let intervalId = null;
let stopped = true;
let tickPromise = null;

const inFlightSloIds = new Set();
const activeTasks = new Set();

export const metrics = {
  evaluationsCompleted: 0,
  evaluationErrors: 0,
  lastEvaluationAt: null,
  lastSuccessAt: null,
};

/**
 * Atomically claims the next due SLO by updating its lease fields.
 * Prevents multiple workers/replicas from running concurrent evaluations for the same SLO.
 */
export const claimNextDueSlo = async () => {
  const now = new Date();
  const token = randomUUID();

  return Slo.findOneAndUpdate(
    {
      enabled: true,
      $and: [
        {
          $or: [
            { nextEvaluationAt: { $lte: now } },
            { nextEvaluationAt: null },
            { nextEvaluationAt: { $exists: false } },
          ],
        },
        {
          $or: [
            { evaluationLeaseUntil: null },
            { evaluationLeaseUntil: { $exists: false } },
            { evaluationLeaseUntil: { $lte: now } },
          ],
        },
        {
          $or: [
            { evaluationRetryAt: null },
            { evaluationRetryAt: { $exists: false } },
            { evaluationRetryAt: { $lte: now } },
          ],
        },
      ],
    },
    {
      $set: {
        evaluationLeaseToken: token,
        evaluationLeaseUntil: new Date(
          now.getTime() + env.SLO_EVALUATION_LEASE_MS,
        ),
      },
    },
    {
      sort: { nextEvaluationAt: 1, _id: 1 },
      returnDocument: "after",
      select: "+evaluationLeaseToken +evaluationLeaseUntil +evaluationRetryAt",
    },
  ).then((slo) => (slo ? { slo, token } : null));
};

/**
 * Executes evaluation for a claimed SLO with lease renewal heartbeat and timeout boundary.
 */
export const runClaimedSlo = async ({ slo, token }) => {
  const id = String(slo._id);
  if (inFlightSloIds.has(id)) return null;

  inFlightSloIds.add(id);
  const query = { _id: slo._id, evaluationLeaseToken: token };

  let timeout;
  let heartbeat;
  let work;

  try {
    heartbeat = setInterval(
      () => {
        Slo.updateOne(query, {
          $set: {
            evaluationLeaseUntil: new Date(
              Date.now() + env.SLO_EVALUATION_LEASE_MS,
            ),
          },
        }).catch((err) =>
          logger.warn("SLO lease renewal heartbeat failed", {
            sloId: id,
            error: err.message,
          }),
        );
      },
      Math.max(1000, Math.floor(env.SLO_EVALUATION_LEASE_MS / 3)),
    );
    heartbeat.unref?.();

    work = evaluateSlo(slo._id, { now: new Date(), token });

    const deadline = new Promise((_, reject) => {
      timeout = setTimeout(
        () => reject(new Error("SLO evaluation exceeded lease timeout")),
        env.SLO_EVALUATION_LEASE_MS - 5000,
      );
      timeout.unref?.();
    });

    const result = await Promise.race([work, deadline]);

    metrics.evaluationsCompleted += 1;
    metrics.lastEvaluationAt = new Date();
    metrics.lastSuccessAt = new Date();

    return result;
  } catch (error) {
    metrics.evaluationErrors += 1;
    logger.error("SLO evaluation job failed", {
      sloId: id,
      sloName: slo.name,
      error: error.message,
    });

    await Slo.updateOne(query, {
      $set: {
        evaluationRetryAt: new Date(
          Date.now() + env.SLO_EVALUATION_RETRY_DELAY_MS,
        ),
      },
      $unset: { evaluationLeaseToken: 1, evaluationLeaseUntil: 1 },
    });

    return null;
  } finally {
    clearTimeout(timeout);
    clearInterval(heartbeat);
    inFlightSloIds.delete(id);
  }
};

const tick = async () => {
  if (stopped || tickPromise) return tickPromise;

  tickPromise = (async () => {
    try {
      const available = Math.max(
        0,
        env.SLO_EVALUATION_CONCURRENCY - activeTasks.size,
      );
      if (available <= 0) return;

      const claims = await Promise.all(
        Array.from({ length: available }, () => claimNextDueSlo()),
      );

      for (const claim of claims.filter(Boolean)) {
        const task = runClaimedSlo(claim)
          .catch((err) => {
            logger.error("SLO worker task error", { error: err.message });
          })
          .finally(() => {
            activeTasks.delete(task);
          });
        activeTasks.add(task);
      }
    } catch (err) {
      logger.error("SLO scheduler tick encountered error", {
        error: err.message,
      });
    } finally {
      tickPromise = null;
    }
  })();

  return tickPromise;
};

export const start = () => {
  if (!stopped) return;
  stopped = false;
  logger.info("SLO evaluation scheduler started", {
    tickMs: env.SLO_EVALUATION_TICK_MS,
    concurrency: env.SLO_EVALUATION_CONCURRENCY,
  });

  intervalId = setInterval(tick, env.SLO_EVALUATION_TICK_MS);
  intervalId.unref?.();

  // Initial immediate tick
  void tick();
};

export const stop = async () => {
  if (stopped) return;
  stopped = true;

  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }

  if (tickPromise) {
    await tickPromise.catch(() => {});
  }

  if (activeTasks.size > 0) {
    await Promise.allSettled(Array.from(activeTasks));
  }

  logger.info("SLO evaluation scheduler stopped");
};
