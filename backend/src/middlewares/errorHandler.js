/**
 * Global error-handling middleware
 * Must be registered LAST in the middleware chain.
 */

import env from "../config/env.js";
import logger from "../utils/logger.js";

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

  // Build response payload
  const response = {
    success: false,
    message: isOperational ? err.message : "Internal server error",
  };

  // Attach stack trace in development only
  if (env.isDev) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

export default errorHandler;
