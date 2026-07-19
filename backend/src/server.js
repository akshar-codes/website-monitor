import app from "./app.js";
import env from "./config/env.js";
import connectDB from "./config/db.js";
import logger from "./utils/logger.js";
import { registerProcessHandlers } from "./utils/processHandlers.js";
import { start, stop } from "./workers/scheduler.js";
import { verifyMailTransport } from "./config/mail.js";

let server = null;
let shuttingDown = false;

/**
 * Graceful shutdown — stops the polling scheduler, closes the HTTP
 */
const shutdown = (signal, exitCode = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info(`${signal} received — shutting down gracefully`);

  // Stop the scheduler first (no new polls)
  stop();

  if (!server) {
    process.exit(exitCode);
    return;
  }

  server.close(() => {
    logger.info("HTTP server closed");
    process.exit(exitCode);
  });

  // Force-kill after 10 s if connections linger
  setTimeout(() => {
    logger.error("Could not close connections in time, forcing shutdown");
    process.exit(1);
  }, 10_000);
};

// Registered up front so a crash during startup (e.g. inside connectDB)
// is still captured and logged.
registerProcessHandlers((signal) => shutdown(signal, 1));

const startServer = async () => {
  logger.info(`Starting website-monitor API — environment: ${env.NODE_ENV}`);

  // 1. Connect to MongoDB
  await connectDB();

  // 2. Verify outbound email connectivity (non-fatal — see config/mail.js)
  await verifyMailTransport();

  // 3. Start the monitoring scheduler
  start();

  // 4. Start listening
  server = app.listen(env.PORT, () => {
    logger.info(
      `Server running in ${env.NODE_ENV} mode on http://localhost:${env.PORT}`,
    );
  });

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
};

startServer().catch((error) => {
  logger.error(`Fatal startup error: ${error.message}`, {
    stack: error.stack,
  });
  process.exit(1);
});
