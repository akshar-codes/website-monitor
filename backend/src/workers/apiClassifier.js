import { HEALTH_STATUS, FAILURE_REASONS } from "../config/constants.js";

/**
 * Classify raw API monitor execution results into HealthCheck-compatible fields.
 *
 * Distinguishes transport-level completion from status code acceptance:
 * - Transport failures (DNS, TLS, connection, timeouts, size limits) -> DOWN with corresponding failureReason.
 * - Completed HTTP transport with expected status -> UP.
 * - Completed HTTP transport with unexpected status -> DOWN with HTTP_ERROR, preserving all response metadata.
 * - Component statuses for API monitors are always UNKNOWN.
 */
export const classifyApiResult = (rawResult, apiConfig = {}) => {
  const expectedStatusCodes =
    Array.isArray(apiConfig.expectedStatusCodes) &&
    apiConfig.expectedStatusCodes.length > 0
      ? apiConfig.expectedStatusCodes
      : [200];

  const {
    transportCompleted = false,
    httpStatus = null,
    responseTime = 0,
    timings = null,
    failureReason = null,
    failureCategory = "unknown",
    safeFailureReason = null,
    diagnostics = {},
  } = rawResult;

  let status;
  let finalFailureReason = null;
  let finalFailureCategory = failureCategory;
  let finalSafeReason = safeFailureReason;

  if (!transportCompleted || httpStatus == null) {
    status = HEALTH_STATUS.DOWN;
    finalFailureReason = failureReason || FAILURE_REASONS.UNKNOWN;
  } else if (expectedStatusCodes.includes(httpStatus)) {
    status = HEALTH_STATUS.UP;
    finalFailureReason = null;
    finalFailureCategory = "none";
  } else {
    status = HEALTH_STATUS.DOWN;
    finalFailureReason = FAILURE_REASONS.HTTP_ERROR;
    finalFailureCategory = "unexpected_http_status";
    finalSafeReason = `Received HTTP ${httpStatus}, expected [${expectedStatusCodes.join(", ")}]`;
  }

  const enrichedDiagnostics = {
    ...diagnostics,
    transportCompleted,
    httpStatus,
    expectedStatusCodes,
    failureCategory: finalFailureCategory,
    safeFailureReason: finalSafeReason,
    timing: timings || diagnostics.timing || null,
  };

  return {
    status,
    frontendStatus: HEALTH_STATUS.UNKNOWN,
    backendStatus: HEALTH_STATUS.UNKNOWN,
    databaseStatus: HEALTH_STATUS.UNKNOWN,
    failureReason: finalFailureReason,
    httpStatus,
    responseTime,
    timings: timings || diagnostics.timing || null,
    diagnostics: enrichedDiagnostics,
  };
};
