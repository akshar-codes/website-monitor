import morgan from "morgan";
import env from "../config/env.js";
import { httpLogStream } from "../utils/logger.js";
import { sanitizeUrl } from "../utils/sanitizeLogData.js";

// Redact sensitive query params (?token=..., ?apiKey=...) before the URL
// ever reaches a log line.
morgan.token("safe-url", (req) => sanitizeUrl(req.originalUrl || req.url));

// Prefer the original client IP behind a proxy/load balancer.
morgan.token(
  "real-ip",
  (req) => req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip,
);

/**
 * Structured JSON access-log line — one object per request — written to
 * logs/http.log via Winston in production.
 */
const jsonFormat = (tokens, req, res) =>
  JSON.stringify({
    method: tokens.method(req, res),
    url: tokens["safe-url"](req, res),
    status: Number(tokens.status(req, res)),
    responseTimeMs: Number(tokens["response-time"](req, res)),
    contentLength: tokens.res(req, res, "content-length") || "0",
    ip: tokens["real-ip"](req, res),
    userAgent: tokens["user-agent"](req, res),
  });

// Concise, human-readable line for the local dev console.
const devFormat =
  ":method :safe-url :status :response-time ms - :res[content-length]b";

// Reduce log noise from monitoring/uptime probes hitting /api/health in prod.
const skipHealthCheck = (req) =>
  env.isProd && req.originalUrl === "/api/health";

/**
 * HTTP request logger.
 * - Development: concise line, printed to the console via Winston.
 * - Production: structured JSON, written to logs/http.log via Winston.
 */
const requestLogger = morgan(env.isDev ? devFormat : jsonFormat, {
  stream: httpLogStream,
  skip: skipHealthCheck,
});

export default requestLogger;
