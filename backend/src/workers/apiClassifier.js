import { HEALTH_STATUS, FAILURE_REASONS } from "../config/constants.js";

/**
 * Classify raw API monitor execution results into HealthCheck-compatible fields.
 *
 * Distinguishes transport-level completion from status code acceptance and assertion outcomes:
 * - Transport failures (DNS, TLS, connection, timeouts, size limits) -> DOWN with corresponding failureReason.
 * - Completed HTTP transport with required assertion errors/failures -> DOWN.
 * - Completed HTTP transport with unexpected status code -> DOWN with HTTP_ERROR.
 * - Completed HTTP transport with accepted status and passing assertions -> UP.
 * - Component statuses for API monitors are always UNKNOWN.
 */
export const classifyApiResult = (
  rawResult,
  apiConfig = {},
  assertionEvaluation = null,
) => {
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
  } else if (assertionEvaluation?.hasErrors) {
    status = HEALTH_STATUS.DOWN;
    finalFailureReason = FAILURE_REASONS.ASSERTION_ERROR;
    finalFailureCategory = "assertion_error";
    const firstErr = assertionEvaluation.results?.find(
      (r) => r.outcome === "error",
    );
    finalSafeReason =
      firstErr?.message ||
      "One or more API assertions encountered an execution error";
  } else if (assertionEvaluation?.hasFailures) {
    status = HEALTH_STATUS.DOWN;
    finalFailureReason = FAILURE_REASONS.ASSERTION_FAILURE;
    finalFailureCategory = "assertion_failure";
    const firstFail = assertionEvaluation.results?.find(
      (r) => r.outcome === "failed",
    );
    finalSafeReason = firstFail?.message || "One or more API assertions failed";
  } else if (!expectedStatusCodes.includes(httpStatus)) {
    status = HEALTH_STATUS.DOWN;
    finalFailureReason = FAILURE_REASONS.HTTP_ERROR;
    finalFailureCategory = "unexpected_http_status";
    finalSafeReason = `Received HTTP ${httpStatus}, expected [${expectedStatusCodes.join(", ")}]`;
  } else {
    status = HEALTH_STATUS.UP;
    finalFailureReason = null;
    finalFailureCategory = "none";
    finalSafeReason = null;
  }

  const enrichedDiagnostics = {
    ...diagnostics,
    transportCompleted,
    httpStatus,
    expectedStatusCodes,
    assertionSummary: assertionEvaluation?.summary || null,
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
