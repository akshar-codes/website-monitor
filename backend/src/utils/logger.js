
const { createLogger, format, transports } = require("winston");
const path = require("path");

const LOG_DIR = path.resolve(__dirname, "../../logs");

const logger = createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: format.combine(
    format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  defaultMeta: { service: "website-monitor" },
  transports: [
    // ── Combined log ──
    new transports.File({
      filename: path.join(LOG_DIR, "combined.log"),
      maxsize: 5 * 1024 * 1024, // 5 MB
      maxFiles: 5,
    }),
    // ── Error-only log ──
    new transports.File({
      filename: path.join(LOG_DIR, "error.log"),
      level: "error",
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5,
    }),
  ],
});

// Pretty-print to console in development
if (process.env.NODE_ENV !== "production") {
  logger.add(
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.printf(({ timestamp, level, message, stack }) => {
          return `${timestamp} ${level}: ${stack || message}`;
        })
      ),
    })
  );
}

module.exports = logger;
