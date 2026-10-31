import app from "./app.js";
import env from "./config/env.js";
import connectDB from "./config/db.js";
import logger from "./utils/logger.js";
import { registerProcessHandlers } from "./utils/processHandlers.js";
import { start, stop } from "./workers/scheduler.js";
import {
  start as startSslScheduler,
  stop as stopSslScheduler,
} from "./services/sslScheduler.js";
import { verifyMailTransport } from "./config/mail.js";
import { dispatchNotificationDigests } from "./services/notification.service.js";

let server = null;
let shuttingDown = false;
let digestTimer = null;

/**
 * Graceful shutdown — stops both the health-check and SSL polling
 * schedulers, closes the HTTP server, then exits.
 */
const shutdown = async (signal, exitCode = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info(`${signal} received — shutting down gracefully`);

  // Keep the shutdown deadline active while worker tasks drain too.
  const forceShutdownTimer = setTimeout(() => {
    logger.error(
      "Could not finish graceful shutdown in time, forcing shutdown",
    );
    process.exit(1);
  }, 10_000);
  forceShutdownTimer.unref?.();

  // Stop the schedulers first (no new polls/checks)
  await stop();
  await stopSslScheduler();
  if (digestTimer) clearInterval(digestTimer);

  if (!server) {
    clearTimeout(forceShutdownTimer);
    process.exit(exitCode);
    return;
  }

  server.close(() => {
    clearTimeout(forceShutdownTimer);
    logger.info("HTTP server closed");
    process.exit(exitCode);
  });
};

// Registered up front so a crash during startup (e.g. inside connectDB)
// is still captured and logged.
registerProcessHandlers((signal) => shutdown(signal, 1));

const startServer = async () => {
  logger.info(`Starting site-watch API — environment: ${env.NODE_ENV}`);

  // 1. Connect to MongoDB
  await connectDB();

  // 2. Verify outbound email connectivity (non-fatal — see config/mail.js)
  await verifyMailTransport();

  // 3. Start the monitoring schedulers
  start();
  startSslScheduler();
  digestTimer = setInterval(
    () =>
      dispatchNotificationDigests().catch((error) =>
        logger.error(`Notification digest run failed: ${error.message}`),
      ),
    15 * 60 * 1000,
  );
  digestTimer.unref?.();

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
