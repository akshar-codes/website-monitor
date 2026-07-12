import env from "../config/env.js";
import logger from "../utils/logger.js";
import { sendError } from "../utils/apiResponse.js";

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, _next) => {
  // Default to 500 if no status code was set
  const statusCode = err.statusCode || 500;
  const isOperational = err.isOperational ?? false;

  // Always log the error
  if (statusCode >= 500 || !isOperational) {
    logger.error(`[${req.method}] ${req.originalUrl} → ${err.message}`, {
      stack: err.stack,
      statusCode,
    });
  } else {
    logger.warn(`[${req.method}] ${req.originalUrl} → ${err.message}`, {
      statusCode,
    });
  }

  const message = isOperational ? err.message : "Internal server error";

  sendError(res, {
    statusCode,
    message,
    errors: err.errors || undefined,
    // Attach stack trace in development only
    ...(env.isDev && { stack: err.stack }),
  });
};

export default errorHandler;
