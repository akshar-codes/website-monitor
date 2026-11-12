import logger from "../utils/logger.js";
import { evaluatePendingDeploymentRegressions } from "../services/deploymentRegression.service.js";

const DEFAULT_INTERVAL_MS = 60_000; // 60 seconds

let timer = null;
let running = false;

/**
 * Executes a single sweep of pending deployment regression evaluations.
 */
export const runDeploymentRegressionSweep = async () => {
  if (running) return;
  running = true;

  try {
    const result = await evaluatePendingDeploymentRegressions(
      { lookbackHours: 24 },
      { isInternal: true },
    );
    if (result && (result.evaluatedCount > 0 || result.regressionsFound > 0)) {
      logger.debug(
        `[DeploymentRegressionWorker] Sweep completed: ${result.evaluatedCount} evaluations, ${result.regressionsFound} regressions found.`,
      );
    }
  } catch (error) {
    logger.warn(
      `[DeploymentRegressionWorker] Background evaluation sweep error: ${error.message}`,
      { error },
    );
  } finally {
    running = false;
  }
};

/**
 * Starts the deployment regression background worker.
 */
export const start = (intervalMs = DEFAULT_INTERVAL_MS) => {
  if (timer) return;
  logger.info(
    `[DeploymentRegressionWorker] Starting worker (interval: ${intervalMs}ms)`,
  );
  timer = setInterval(() => {
    void runDeploymentRegressionSweep();
  }, intervalMs);
  timer.unref?.();

  // Run first sweep asynchronously on startup
  void runDeploymentRegressionSweep();
};

/**
 * Gracefully stops the deployment regression background worker.
 */
export const stop = async () => {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  while (running) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  logger.info("[DeploymentRegressionWorker] Stopped worker");
};
