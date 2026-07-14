/**
 * MongoDB connection via Mongoose
 */

import mongoose from "mongoose";
import env from "./env.js";
import logger from "../utils/logger.js";
import { maskConnectionString } from "../utils/sanitizeLogData.js";

const connectDB = async () => {
  logger.info(`Connecting to MongoDB: ${maskConnectionString(env.MONGO_URI)}`);

  try {
    const conn = await mongoose.connect(env.MONGO_URI);
    logger.info(
      `MongoDB connected: ${conn.connection.host}/${conn.connection.name}`,
    );
  } catch (error) {
    logger.error(`MongoDB connection error: ${error.message}`, {
      stack: error.stack,
    });
    process.exit(1);
  }
};

// ── Connection lifecycle logging ──
// Registered once at module load — covers the initial connection as well
// as any reconnects Mongoose performs automatically afterwards.

mongoose.connection.on("connecting", () => {
  logger.debug("MongoDB connecting…");
});

mongoose.connection.on("connected", () => {
  logger.debug("MongoDB connection established");
});

mongoose.connection.on("disconnected", () => {
  logger.warn("MongoDB disconnected");
});

mongoose.connection.on("reconnected", () => {
  logger.info("MongoDB reconnected");
});

mongoose.connection.on("error", (error) => {
  logger.error(`MongoDB connection error: ${error.message}`, {
    stack: error.stack,
  });
});

export default connectDB;
