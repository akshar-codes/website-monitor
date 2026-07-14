import logger from "./logger.js";

/**
 * Registers process-level handlers for uncaught exceptions and unhandled
 * promise rejections.
 */
export const registerProcessHandlers = (shutdown) => {
  process.on("unhandledRejection", (reason) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    logger.error(`Unhandled Rejection: ${error.message}`, {
      stack: error.stack,
      type: "unhandledRejection",
    });
    shutdown("unhandledRejection");
  });

  process.on("uncaughtException", (error) => {
    logger.error(`Uncaught Exception: ${error.message}`, {
      stack: error.stack,
      type: "uncaughtException",
    });
    shutdown("uncaughtException");
  });
};
