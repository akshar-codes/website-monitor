import { HEALTH_STATUS, FAILURE_REASONS } from "../config/constants.js";

/**
 * Map a raw status string from the monitored endpoint to our enum.
 * Tolerates common synonyms (ok, healthy, running, etc.).
 */
const normalizeComponentStatus = (raw) => {
  if (!raw) return HEALTH_STATUS.UNKNOWN;
  const s = String(raw).toLowerCase().trim();
  if (["up", "ok", "healthy", "running", "operational"].includes(s))
    return HEALTH_STATUS.UP;
  if (["down", "error", "failed", "offline", "unavailable"].includes(s))
    return HEALTH_STATUS.DOWN;
  if (["degraded", "slow", "warning", "partial"].includes(s))
    return HEALTH_STATUS.DEGRADED;
  return HEALTH_STATUS.UNKNOWN;
};

const isValidContract = (body) => {
  if (typeof body.status !== "string") return false;
  if (!body.services || typeof body.services !== "object") return false;
  if (typeof body.services.frontend !== "string") return false;
  if (typeof body.services.backend !== "string") return false;
  if (typeof body.services.database !== "string") return false;
  return true;
};

/**
 * Classify a poll result into structured status fields.
 */
export const classify = (pollResult) => {
  const { ok, httpStatus, body, failureReason } = pollResult;

  // ── Total network failure (no HTTP response at all) ──
  if (!ok && httpStatus == null) {
    return {
      status: HEALTH_STATUS.DOWN,
      frontendStatus: HEALTH_STATUS.UNKNOWN,
      backendStatus: HEALTH_STATUS.UNKNOWN,
      databaseStatus: HEALTH_STATUS.UNKNOWN,
      failureReason,
    };
  }

  // ── Got an HTTP response but non-2xx ──
  if (!ok) {
    return {
      status: HEALTH_STATUS.DOWN,
      frontendStatus: HEALTH_STATUS.UNKNOWN,
      backendStatus: HEALTH_STATUS.UNKNOWN,
      databaseStatus: HEALTH_STATUS.UNKNOWN,
      failureReason: failureReason || FAILURE_REASONS.HTTP_ERROR,
    };
  }

  // ── 2xx response but body is not valid JSON ──
  if (!body || typeof body !== "object") {
    return {
      status: HEALTH_STATUS.DEGRADED,
      frontendStatus: HEALTH_STATUS.UNKNOWN,
      backendStatus: HEALTH_STATUS.UNKNOWN,
      databaseStatus: HEALTH_STATUS.UNKNOWN,
      failureReason: FAILURE_REASONS.INVALID_JSON,
    };
  }

  // ── Valid JSON but missing required contract fields ──
  if (!isValidContract(body)) {
    return {
      status: HEALTH_STATUS.DEGRADED,
      frontendStatus: HEALTH_STATUS.UNKNOWN,
      backendStatus: HEALTH_STATUS.UNKNOWN,
      databaseStatus: HEALTH_STATUS.UNKNOWN,
      failureReason: FAILURE_REASONS.INVALID_CONTRACT,
    };
  }

  // ── Parse component statuses from JSON body ──
  const frontendStatus = normalizeComponentStatus(body.services.frontend);
  const backendStatus = normalizeComponentStatus(body.services.backend);
  const databaseStatus = normalizeComponentStatus(body.services.database);

  // ── Derive overall status from component statuses ──

  const components = [frontendStatus, backendStatus, databaseStatus];

  let status;
  let derivedFailureReason = null;

  if (components.includes(HEALTH_STATUS.DOWN)) {
    status = HEALTH_STATUS.DOWN;
    // Failure reason priority: frontend → backend → database
    if (frontendStatus === HEALTH_STATUS.DOWN)
      derivedFailureReason = FAILURE_REASONS.FRONTEND_DOWN;
    else if (backendStatus === HEALTH_STATUS.DOWN)
      derivedFailureReason = FAILURE_REASONS.BACKEND_DOWN;
    else derivedFailureReason = FAILURE_REASONS.DATABASE_DOWN;
  } else if (components.includes(HEALTH_STATUS.DEGRADED)) {
    status = HEALTH_STATUS.DEGRADED;
  } else if (components.every((c) => c === HEALTH_STATUS.UP)) {
    status = HEALTH_STATUS.UP;
  } else {
    // Some/all components are "unknown" but none are down or degraded.
    // Fail safe: insufficient data should not imply healthy.
    status = HEALTH_STATUS.DEGRADED;
    derivedFailureReason = FAILURE_REASONS.INSUFFICIENT_HEALTH_DATA;
  }

  return {
    status,
    frontendStatus,
    backendStatus,
    databaseStatus,
    failureReason: derivedFailureReason,
  };
};
