import env from "../config/env.js";
import logger from "../utils/logger.js";
import { sendError } from "../utils/apiResponse.js";
import ApiError from "../utils/ApiError.js";
import {
  handleCastErrorDB,
  handleDuplicateFieldsDB,
  handleValidationErrorDB,
  handleZodError,
  handleJWTError,
  handleJWTExpiredError,
  handleJWTNotBeforeError,
} from "../utils/errorConverters.js";

/**
 * Normalise any thrown/`next()`-ed error into an ApiError.
 */
const normalizeError = (err) => {
  if (err instanceof ApiError) return err;

  switch (err.name) {
    case "CastError":
      return handleCastErrorDB(err);
    case "ValidationError":
      return err.errors
        ? handleValidationErrorDB(err)
        : ApiError.internal(err.message);
    case "ZodError":
      return handleZodError(err);
    case "JsonWebTokenError":
      return handleJWTError();
    case "TokenExpiredError":
      return handleJWTExpiredError();
    case "NotBeforeError":
      return handleJWTNotBeforeError();
    default:
      break;
  }

  // MongoDB duplicate-key error — raised by the driver, not Mongoose, so
  // it has no `.name` of "ValidationError"; identified by `err.code`.
  if (err.code === 11000) {
    return handleDuplicateFieldsDB(err);
  }

  return ApiError.internal(err.message);
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, _next) => {
  const apiError = normalizeError(err);
  const statusCode = apiError.statusCode || 500;
  const isOperational = apiError.isOperational ?? false;

  // Always log the error
  if (statusCode >= 500 || !isOperational) {
    logger.error(`[${req.method}] ${req.originalUrl} → ${apiError.message}`, {
      stack: err.stack,
      statusCode,
    });
  } else {
    logger.warn(`[${req.method}] ${req.originalUrl} → ${apiError.message}`, {
      statusCode,
    });
  }

  const message = isOperational ? apiError.message : "Internal server error";

  sendError(res, {
    statusCode,
    message,
    errors: apiError.errors || undefined,
    // Attach stack trace in development only
    ...(env.isDev && { stack: err.stack }),
  });
};

export default errorHandler;
