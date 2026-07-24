class ApiError extends Error {
  constructor(
    statusCode,
    message,
    isOperational = true,
    errors = null,
    code = null,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.errors = errors;
    this.code = code;
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

  static emailNotVerified(
    message = "Please verify your email address before logging in.",
  ) {
    return new ApiError(403, message, true, null, "EMAIL_NOT_VERIFIED");
  }

  /**
   * The account is authenticated but its current subscription plan
   * doesn't meet the minimum tier required for the requested action.
   * `requiredPlan` (when supplied) is surfaced as a structured detail so
   * the frontend can deep-link straight to the right upgrade option
   * instead of parsing the message string. Used by
   * middlewares/planAuthorization.js and middlewares/featureAccess.js
   * (requireWithinLimit).
   */
  static upgradeRequired(
    message = "This action requires a higher subscription plan.",
    requiredPlan = null,
  ) {
    return new ApiError(
      403,
      message,
      true,
      requiredPlan
        ? [
            {
              field: "plan",
              message: `Requires the ${requiredPlan} plan or higher`,
            },
          ]
        : null,
      "UPGRADE_REQUIRED",
    );
  }

  /**
   * The account is authenticated and on a valid plan, but the specific
   * feature flag being checked (see config/features.js) isn't enabled for
   * that plan. Distinct from `upgradeRequired` so the frontend can decide
   * whether to prompt an upgrade or simply hide/disable the control. Used
   * by middlewares/featureAccess.js (requireFeature).
   */
  static featureRestricted(
    message = "This feature isn't available on your current plan.",
  ) {
    return new ApiError(403, message, true, null, "FEATURE_RESTRICTED");
  }
}

export default ApiError;
