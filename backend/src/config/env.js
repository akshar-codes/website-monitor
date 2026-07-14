import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root (no-op when vars are already in the environment)
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

// ── Required variables ────────────────────────────────────────────────────────

const REQUIRED = ["MONGO_URI"];

const missing = REQUIRED.filter((key) => !process.env[key]);
if (missing.length > 0) {
  // Synchronous throw — intentional. If the DB URI is absent the server
  // cannot start, so failing loudly here is the right behaviour.
  throw new Error(
    `Missing required environment variable(s): ${missing.join(", ")}. ` +
      `Check your .env file against .env.example.`,
  );
}

const NODE_ENV = process.env.NODE_ENV || "development";

const DEFAULT_LOG_LEVEL = NODE_ENV === "production" ? "http" : "debug";

// ── Parsed config object ──────────────────────────────────────────────────────

const env = {
  // Server
  NODE_ENV,
  PORT: parseInt(process.env.PORT, 10) || 5000,

  // MongoDB
  MONGO_URI: process.env.MONGO_URI,

  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || DEFAULT_LOG_LEVEL,
  LOG_DIR: process.env.LOG_DIR || null, // null → defaults to backend/logs

  // Rate limiting
  RATE_LIMIT_WINDOW_MS:
    parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900_000,
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,

  // Redis / BullMQ (reserved for future queue integration)
  REDIS_HOST: process.env.REDIS_HOST || "127.0.0.1",
  REDIS_PORT: parseInt(process.env.REDIS_PORT, 10) || 6379,

  // Monitoring worker
  POLL_TICK_MS: parseInt(process.env.POLL_TICK_MS, 10) || 10_000,
  POLL_TIMEOUT_MS: parseInt(process.env.POLL_TIMEOUT_MS, 10) || 10_000,
  MONITOR_RETRY_COUNT: parseInt(process.env.MONITOR_RETRY_COUNT, 10) || 2,
  MONITOR_RETRY_DELAY: parseInt(process.env.MONITOR_RETRY_DELAY, 10) || 1_000,
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

export default env;
