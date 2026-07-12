import env from "../config/env.js";
import logger from "../utils/logger.js";
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

/** Human-readable machine code per HTTP status — useful for client-side branching. */
const STATUS_CODE_TO_ERROR_CODE = {
  400: "BAD_REQUEST",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  422: "UNPROCESSABLE_ENTITY",
  429: "TOO_MANY_REQUESTS",
  500: "INTERNAL_ERROR",
};

/**
 * Convert any thrown value into an ApiError instance.
 */
const normalizeError = (err) => {
  if (err instanceof ApiError) return err;

  // ── MongoDB / Mongoose ──
  if (err.name === "CastError") return handleCastErrorDB(err);
  if (err.code === 11000) return handleDuplicateFieldsDB(err);
  if (err.name === "ValidationError" && err.errors) {
    return handleValidationErrorDB(err);
  }

  // ── JWT / Authentication (jsonwebtoken) ──
  if (err.name === "JsonWebTokenError") return handleJWTError();
  if (err.name === "TokenExpiredError") return handleJWTExpiredError();
  if (err.name === "NotBeforeError") return handleJWTNotBeforeError();

  // ── Zod (safety net — controllerHelpers.validate() normally catches first) ──
  if (err.name === "ZodError") return handleZodError(err);

  return new ApiError(
    Number.isInteger(err.statusCode) ? err.statusCode : 500,
    err.message || "Internal server error",
    false,
  );
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, _next) => {
  const normalized = normalizeError(err);
  const { statusCode, isOperational, errors } = normalized;

  const clientMessage =
    isOperational || env.isDev ? normalized.message : "Internal server error";

  // ── Logging — always logs the *original* error's stack, regardless of masking ──
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

  // ── Standardized response payload ──
  const response = {
    success: false,
    message: clientMessage,
    errorCode: STATUS_CODE_TO_ERROR_CODE[statusCode] || "ERROR",
  };

  if (errors && errors.length) {
    response.errors = errors;
  }

  if (env.isDev) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

export default errorHandler;
