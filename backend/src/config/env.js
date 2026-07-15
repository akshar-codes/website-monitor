import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { z } from "zod";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root (no-op when vars are already in the environment)
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

// ── Schema ─────────────────────────────────────────────────────────────────

const envSchema = z.object({
  // ── Server ──
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(5000),

  // ── MongoDB ──
  MONGO_URI: z
    .string({ required_error: "MONGO_URI is required" })
    .min(1, "MONGO_URI cannot be empty"),

  // ── Logging ──
  LOG_LEVEL: z
    .enum(["error", "warn", "info", "http", "verbose", "debug", "silly"])
    .optional(),
  LOG_DIR: z.string().optional(),

  // ── Rate limiting ──
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),

  // ── Redis (reserved for a future session store / queue integration) ──
  REDIS_HOST: z.string().default("127.0.0.1"),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),

  // ── Monitoring worker ──
  POLL_TICK_MS: z.coerce.number().int().positive().default(10_000),
  POLL_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  MONITOR_RETRY_COUNT: z.coerce.number().int().min(0).default(2),
  MONITOR_RETRY_DELAY: z.coerce.number().int().min(0).default(1_000),
  CONSECUTIVE_FAILURE_THRESHOLD: z.coerce.number().int().positive().default(3),

  // ── Production hardening ──

  /** Comma-separated whitelist of origins allowed to make credentialed requests. */
  CORS_ORIGIN: z
    .string({ required_error: "CORS_ORIGIN is required" })
    .min(1, "CORS_ORIGIN cannot be empty"),

  /** express.json()/urlencoded() body size limit, e.g. "1mb", "500kb". */
  MAX_BODY_SIZE: z.string().default("1mb"),

  /**
   * Number of reverse-proxy hops to trust for req.ip / X-Forwarded-*.
   */
  TRUST_PROXY: z.coerce.number().int().min(0).default(1),

  /**
   * Signs cookies (via cookie-parser) so they're tamper-evident — required
   */
  COOKIE_SECRET: z
    .string({ required_error: "COOKIE_SECRET is required" })
    .min(32, "COOKIE_SECRET must be at least 32 characters"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.errors || parsed.error.issues || [];
  const details = issues
    .map((e) => `  - ${e.path.join(".") || "(root)"}: ${e.message}`)
    .join("\n");

  throw new Error(
    `Invalid environment configuration:\n${details}\n` +
      `Check your .env file against .env.example.`,
  );
}

const parsedEnv = parsed.data;

// ── Derived / exported config object ──────────────────────────────────────

const env = {
  ...parsedEnv,

  LOG_LEVEL:
    parsedEnv.LOG_LEVEL ||
    (parsedEnv.NODE_ENV === "production" ? "http" : "debug"),

  /** Parsed CORS whitelist, ready for the origin-checking function. */
  get CORS_ORIGINS() {
    return parsedEnv.CORS_ORIGIN.split(",")
      .map((o) => o.trim())
      .filter(Boolean);
  },

  get isDev() {
    return parsedEnv.NODE_ENV === "development";
  },
  get isProd() {
    return parsedEnv.NODE_ENV === "production";
  },
  get isTest() {
    return parsedEnv.NODE_ENV === "test";
  },
};

export default env;
