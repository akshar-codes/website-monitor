/**
 * Environment configuration
 * Loads and validates all environment variables in one place.
 */

const dotenv = require("dotenv");
const path = require("path");

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const env = {
  // Server
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: parseInt(process.env.PORT, 10) || 5000,

  // MongoDB
  MONGO_URI:
    process.env.MONGO_URI || "mongodb://localhost:27017/website-monitor",

  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || "info",

  // Rate limiting
  RATE_LIMIT_WINDOW_MS:
    parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000,
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,

  // Redis / BullMQ
  REDIS_HOST: process.env.REDIS_HOST || "127.0.0.1",
  REDIS_PORT: parseInt(process.env.REDIS_PORT, 10) || 6379,

  // ── Monitoring Worker ──
  POLL_TICK_MS: parseInt(process.env.POLL_TICK_MS, 10) || 10000,
  POLL_TIMEOUT_MS: parseInt(process.env.POLL_TIMEOUT_MS, 10) || 10000,
  MONITOR_RETRY_COUNT: parseInt(process.env.MONITOR_RETRY_COUNT, 10) || 2,
  MONITOR_RETRY_DELAY: parseInt(process.env.MONITOR_RETRY_DELAY, 10) || 1000,
  CONSECUTIVE_FAILURE_THRESHOLD:
    parseInt(process.env.CONSECUTIVE_FAILURE_THRESHOLD, 10) || 3,

  // Derived helpers
  get isDev() {
    return this.NODE_ENV === "development";
  },
  get isProd() {
    return this.NODE_ENV === "production";
  },
  get isTest() {
    return this.NODE_ENV === "test";
  },
};

module.exports = env;
