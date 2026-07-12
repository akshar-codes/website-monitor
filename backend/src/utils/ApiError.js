class ApiError extends Error {
  constructor(statusCode, message, isOperational = true, errors = null) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.errors = errors;
    Error.captureStackTrace(this, this.constructor);
  }

  // ── Convenience factory methods ──

  static badRequest(message = "Bad request") {
    return new ApiError(400, message);
  }

  static validation(errors, message) {
    const topMessage = message || errors?.[0]?.message || "Validation failed";
    return new ApiError(400, topMessage, true, errors);
  }

  static unauthorized(message = "Unauthorized") {
    return new ApiError(401, message);
  }

  static forbidden(message = "Forbidden") {
    return new ApiError(403, message);
  }

  static notFound(message = "Resource not found") {
    return new ApiError(404, message);
  }

  static conflict(message = "Conflict") {
    return new ApiError(409, message);
  }

  static internal(message = "Internal server error") {
    return new ApiError(500, message, false);
  }
}

export default ApiError;
