import { createLogger, format, transports } from "winston";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import env from "../config/env.js";
import { redact } from "./sanitizeLogData.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOG_DIR = env.LOG_DIR
  ? path.resolve(env.LOG_DIR)
  : path.resolve(__dirname, "../../logs");

// winston's File transport writes files but won't create the parent
// directory — create it up front so a fresh checkout doesn't crash.
if (!env.isTest && !fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

/**
 * Strips sensitive fields (passwords, tokens, cookies, secrets, ...)
 * from any metadata merged onto a log entry before it is serialised.
 * Applied to every transport — file and console alike.
 */
const redactMeta = format((info) => {
  const { level, message, timestamp, stack, service, ...meta } = info;
  return { level, message, timestamp, stack, service, ...redact(meta) };
});

const jsonFileFormat = format.combine(
  format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  format.errors({ stack: true }),
  format.splat(),
  redactMeta(),
  format.json(),
);

const consoleFormat = format.combine(
  format.timestamp({ format: "HH:mm:ss" }),
  format.errors({ stack: true }),
  format.splat(),
  redactMeta(),
  format.colorize(),
  format.printf(({ timestamp, level, message, stack, service, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
    return `${timestamp} ${level}: ${stack || message}${metaStr}`;
  }),
);

// http.log should only ever contain genuine HTTP access-log entries,
// not application info/error logs that happen to share the file stream.
const httpOnly = format((info) => (info.level === "http" ? info : false));

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_FILES = 5;

const fileTransports = env.isTest
  ? []
  : [
      // All application logs (info and above), newest data always retained
      // via winston's built-in size-based rotation.
      new transports.File({
        filename: path.join(LOG_DIR, "combined.log"),
        maxsize: MAX_FILE_SIZE,
        maxFiles: MAX_FILES,
        tailable: true,
      }),
      // Errors only — kept separate so on-call debugging doesn't require
      // grepping through the full combined log.
      new transports.File({
        filename: path.join(LOG_DIR, "error.log"),
        level: "error",
        maxsize: MAX_FILE_SIZE,
        maxFiles: MAX_FILES,
        tailable: true,
      }),
      // HTTP access log (populated by the Morgan request-logger middleware).
      new transports.File({
        filename: path.join(LOG_DIR, "http.log"),
        level: "http",
        format: format.combine(httpOnly(), jsonFileFormat),
        maxsize: MAX_FILE_SIZE,
        maxFiles: MAX_FILES,
        tailable: true,
      }),
    ];

const logger = createLogger({
  level: env.LOG_LEVEL,
  format: jsonFileFormat,
  defaultMeta: { service: "website-monitor-api" },
  // Don't let a caught exception inside a transport crash the process —
  // process-level crash handling is owned by utils/processHandlers.js.
  exitOnError: false,
  transports: fileTransports,
  silent: env.isTest,
});

// Pretty, colourised console output in development only — production
// relies on the file transports (and whatever log shipper reads them).
if (!env.isProd && !env.isTest) {
  logger.add(new transports.Console({ format: consoleFormat }));
}

/**
 * Stream adapter so Morgan can pipe HTTP access-log lines through
 * Winston at the "http" level instead of writing directly to stdout.
 */
export const httpLogStream = {
  write: (message) => logger.http(message.trim()),
};

export default logger;
