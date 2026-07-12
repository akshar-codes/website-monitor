class ApiError extends Error {
  constructor(statusCode, message, isOperational = true, errors = null) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.errors = errors; // Array<{ field?: string, message: string }> | null
    Error.captureStackTrace(this, this.constructor);
  }

  // ── Convenience factory methods ──

  static badRequest(message = "Bad request", errors = null) {
    return new ApiError(400, message, true, errors);
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

  static conflict(message = "Conflict", errors = null) {
    return new ApiError(409, message, true, errors);
  }

  static unprocessable(message = "Unprocessable entity", errors = null) {
    return new ApiError(422, message, true, errors);
  }

  static tooManyRequests(message = "Too many requests") {
    return new ApiError(429, message);
  }

  static internal(message = "Internal server error") {
    return new ApiError(500, message, false);
  }
}

export default ApiError;
