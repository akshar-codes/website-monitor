import app from "./app.js";
import env from "./config/env.js";
import connectDB from "./config/db.js";
import logger from "./utils/logger.js";
import { start, stop } from "./workers/scheduler.js";

const startServer = async () => {
  // 1. Connect to MongoDB
  await connectDB();

  // 2. Start the monitoring scheduler
  start();

  // 3. Start listening
  const server = app.listen(env.PORT, () => {
    logger.info(
      `Server running in ${env.NODE_ENV} mode on http://localhost:${env.PORT}`,
    );
  });

  // ── Graceful shutdown ──
  const shutdown = (signal) => {
    logger.info(`${signal} received — shutting down gracefully`);

    // Stop the scheduler first (no new polls)
    stop();

    server.close(() => {
      logger.info("HTTP server closed");
      process.exit(0);
    });

    // Force-kill after 10 s if connections linger
    setTimeout(() => {
      logger.error("Could not close connections in time, forcing shutdown");
      process.exit(1);
    }, 10_000);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  // Catch unhandled rejections / uncaught exceptions
  process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled Rejection:", reason);
    shutdown("unhandledRejection");
  });

  process.on("uncaughtException", (error) => {
    logger.error("Uncaught Exception:", error);
    shutdown("uncaughtException");
  });
};

startServer();
