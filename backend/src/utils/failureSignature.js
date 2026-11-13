import { FAILURE_REASONS } from "../config/constants.js";

/**
 * Standard failure categories for correlation analysis.
 */
export const FAILURE_CATEGORIES = Object.freeze({
  TIMEOUT: "timeout",
  HTTP_GATEWAY_ERROR: "http_gateway_error", // 502, 504
  HTTP_SERVER_ERROR: "http_server_error", // 500, 503
  HTTP_CLIENT_ERROR: "http_client_error", // 4xx
  CONNECTION_REFUSED: "connection_refused",
  DNS_ERROR: "dns_error",
  TLS_ERROR: "tls_error",
  ASSERTION_FAILURE: "assertion_failure",
  GENERIC_ERROR: "generic_error",
});

/**
 * Normalizes raw health check result or diagnostic info into a structured failure signature.
 *
 * @param {Object} check - HealthCheck document or snapshot
 * @returns {Object} { category, code, signature, isTimeout, isGatewayError }
 */
export const normalizeFailureSignature = (check) => {
  if (!check) {
    return {
      category: FAILURE_CATEGORIES.GENERIC_ERROR,
      code: null,
      signature: "unknown",
      isTimeout: false,
      isGatewayError: false,
      description: "No health check evidence available",
    };
  }

  const httpStatus = check.httpStatus || null;
  const failureReason = check.failureReason || null;
  const message = (
    check.diagnostics?.message ||
    check.diagnostics?.safeFailureReason ||
    check.rawResponse?.message ||
    ""
  ).toLowerCase();

  // 1. Gateway Errors (502 Bad Gateway, 504 Gateway Timeout) - classic cascading symptoms
  if (httpStatus === 504 || httpStatus === 502) {
    return {
      category: FAILURE_CATEGORIES.HTTP_GATEWAY_ERROR,
      code: httpStatus,
      signature: `http:${httpStatus}`,
      isTimeout: httpStatus === 504,
      isGatewayError: true,
      description: `HTTP ${httpStatus} (${httpStatus === 504 ? "Gateway Timeout" : "Bad Gateway"})`,
    };
  }

  // 2. Server Errors (500, 503)
  if (httpStatus === 500 || httpStatus === 503) {
    return {
      category: FAILURE_CATEGORIES.HTTP_SERVER_ERROR,
      code: httpStatus,
      signature: `http:${httpStatus}`,
      isTimeout: false,
      isGatewayError: false,
      description: `HTTP ${httpStatus} (${httpStatus === 500 ? "Internal Server Error" : "Service Unavailable"})`,
    };
  }

  // 3. Other 5xx
  if (httpStatus && httpStatus >= 500 && httpStatus <= 599) {
    return {
      category: FAILURE_CATEGORIES.HTTP_SERVER_ERROR,
      code: httpStatus,
      signature: `http:${httpStatus}`,
      isTimeout: false,
      isGatewayError: false,
      description: `HTTP ${httpStatus} Server Error`,
    };
  }

  // 4. 4xx Client Errors
  if (httpStatus && httpStatus >= 400 && httpStatus <= 499) {
    return {
      category: FAILURE_CATEGORIES.HTTP_CLIENT_ERROR,
      code: httpStatus,
      signature: `http:${httpStatus}`,
      isTimeout: false,
      isGatewayError: false,
      description: `HTTP ${httpStatus} Client Error`,
    };
  }

  // 5. Timeouts (socket / connection / read)
  if (
    failureReason === FAILURE_REASONS.TIMEOUT ||
    message.includes("etimedout") ||
    message.includes("esockettimedout") ||
    message.includes("timeout")
  ) {
    return {
      category: FAILURE_CATEGORIES.TIMEOUT,
      code: "ETIMEDOUT",
      signature: "network:timeout",
      isTimeout: true,
      isGatewayError: false,
      description: "Connection / Read Timeout",
    };
  }

  // 6. Connection Refused / Reset
  if (
    failureReason === FAILURE_REASONS.CONNECTION_REFUSED ||
    message.includes("econnrefused") ||
    message.includes("econnreset")
  ) {
    return {
      category: FAILURE_CATEGORIES.CONNECTION_REFUSED,
      code: "ECONNREFUSED",
      signature: "network:conn_refused",
      isTimeout: false,
      isGatewayError: false,
      description: "Connection Refused / Reset",
    };
  }

  // 7. DNS Error
  if (
    failureReason === FAILURE_REASONS.DNS_ERROR ||
    message.includes("enotfound") ||
    message.includes("eai_again") ||
    message.includes("dns")
  ) {
    return {
      category: FAILURE_CATEGORIES.DNS_ERROR,
      code: "ENOTFOUND",
      signature: "dns:resolution_failure",
      isTimeout: false,
      isGatewayError: false,
      description: "DNS Resolution Error",
    };
  }

  // 8. TLS / SSL Error
  if (
    failureReason === FAILURE_REASONS.TLS_ERROR ||
    message.includes("cert") ||
    message.includes("tls") ||
    message.includes("ssl")
  ) {
    return {
      category: FAILURE_CATEGORIES.TLS_ERROR,
      code: "TLS_ERROR",
      signature: "tls:handshake_error",
      isTimeout: false,
      isGatewayError: false,
      description: "TLS / SSL Handshake Error",
    };
  }

  // 9. Assertion Failure
  if (
    failureReason === FAILURE_REASONS.ASSERTION_FAILURE ||
    failureReason === FAILURE_REASONS.ASSERTION_ERROR
  ) {
    return {
      category: FAILURE_CATEGORIES.ASSERTION_FAILURE,
      code: "ASSERTION_FAILED",
      signature: "assertion:failed",
      isTimeout: false,
      isGatewayError: false,
      description: "Assertion Check Failed",
    };
  }

  return {
    category: FAILURE_CATEGORIES.GENERIC_ERROR,
    code: failureReason || "ERROR",
    signature: failureReason ? `generic:${failureReason}` : "generic:error",
    isTimeout: false,
    isGatewayError: false,
    description: failureReason || "Unclassified Error",
  };
};

/**
 * Assesses compatibility between the downstream failure signature and the candidate upstream signature.
 *
 * @param {Object} downstreamSig - Normalized signature of affected downstream service
 * @param {Object} upstreamSig - Normalized signature of candidate upstream service
 * @param {boolean} isUpstreamDependency - Whether candidate is an upstream dependency of downstream service
 * @returns {{ score: number, maxScore: number, matchType: string, description: string }}
 */
export const compareFailureSignatures = (
  downstreamSig,
  upstreamSig,
  isUpstreamDependency = false,
) => {
  // Scenario 1: Downstream timed out or got 504/502 Gateway Timeout while upstream is failing
  // This is the classic signature of an upstream outage causing downstream cascade!
  if (
    isUpstreamDependency &&
    (downstreamSig.isGatewayError || downstreamSig.isTimeout) &&
    (upstreamSig.category === FAILURE_CATEGORIES.HTTP_SERVER_ERROR ||
      upstreamSig.category === FAILURE_CATEGORIES.TIMEOUT ||
      upstreamSig.category === FAILURE_CATEGORIES.CONNECTION_REFUSED)
  ) {
    return {
      score: 15,
      maxScore: 15,
      matchType: "cascading_gateway_timeout",
      description: `Downstream service experienced ${downstreamSig.description} consistent with upstream ${upstreamSig.description}.`,
    };
  }

  // Scenario 2: Identical infrastructure failure signature (e.g. both hit DNS outage, both connection refused)
  if (
    downstreamSig.category === upstreamSig.category &&
    downstreamSig.category !== FAILURE_CATEGORIES.GENERIC_ERROR &&
    downstreamSig.category !== FAILURE_CATEGORIES.HTTP_CLIENT_ERROR
  ) {
    return {
      score: 12,
      maxScore: 15,
      matchType: "identical_infrastructure_signature",
      description: `Both services exhibited identical failure signature: ${downstreamSig.description}.`,
    };
  }

  // Scenario 3: Both returned 5xx Server Errors (e.g. downstream 500 and upstream 500)
  if (
    (downstreamSig.category === FAILURE_CATEGORIES.HTTP_SERVER_ERROR ||
      downstreamSig.category === FAILURE_CATEGORIES.HTTP_GATEWAY_ERROR) &&
    upstreamSig.category === FAILURE_CATEGORIES.HTTP_SERVER_ERROR
  ) {
    return {
      score: 8,
      maxScore: 15,
      matchType: "shared_server_error",
      description: `Both services encountered HTTP 5xx errors (${downstreamSig.code} and ${upstreamSig.code}).`,
    };
  }

  // Scenario 4: Both generic errors
  if (
    downstreamSig.category === FAILURE_CATEGORIES.GENERIC_ERROR &&
    upstreamSig.category === FAILURE_CATEGORIES.GENERIC_ERROR
  ) {
    return {
      score: 4,
      maxScore: 15,
      matchType: "generic_error_overlap",
      description: "Both services reported generic failure states.",
    };
  }

  // Scenario 5: Contradictory / incompatible (e.g. client auth 401 error vs server error)
  return {
    score: 0,
    maxScore: 15,
    matchType: "no_signature_match",
    description: `Failure signatures do not appear directly related (${downstreamSig.description} vs ${upstreamSig.description}).`,
  };
};
