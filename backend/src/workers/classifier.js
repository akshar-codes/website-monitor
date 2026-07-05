/**
 * Map a raw status string from the monitored endpoint to our enum.
 * Tolerates common synonyms (ok, healthy, running, etc.).
 */
const normalizeComponentStatus = (raw) => {
  if (!raw) return "unknown";
  const s = String(raw).toLowerCase().trim();
  if (["up", "ok", "healthy", "running", "operational"].includes(s))
    return "up";
  if (["down", "error", "failed", "offline", "unavailable"].includes(s))
    return "down";
  if (["degraded", "slow", "warning", "partial"].includes(s)) return "degraded";
  return "unknown";
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
const classify = (pollResult) => {
  const { ok, httpStatus, body, failureReason } = pollResult;

  // ── Total network failure (no HTTP response at all) ──
  if (!ok && httpStatus == null) {
    return {
      status: "down",
      frontendStatus: "unknown",
      backendStatus: "unknown",
      databaseStatus: "unknown",
      failureReason,
    };
  }

  // ── Got an HTTP response but non-2xx ──
  if (!ok) {
    return {
      status: "down",
      frontendStatus: "unknown",
      backendStatus: "unknown",
      databaseStatus: "unknown",
      failureReason: failureReason || "http_error",
    };
  }

  // ── 2xx response but body is not valid JSON ──
  if (!body || typeof body !== "object") {
    return {
      status: "degraded",
      frontendStatus: "unknown",
      backendStatus: "unknown",
      databaseStatus: "unknown",
      failureReason: "invalid_json",
    };
  }

  // ── Valid JSON but missing required contract fields ──
  if (!isValidContract(body)) {
    return {
      status: "degraded",
      frontendStatus: "unknown",
      backendStatus: "unknown",
      databaseStatus: "unknown",
      failureReason: "invalid_contract",
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

  if (components.includes("down")) {
    status = "down";
    // Failure reason priority: frontend → backend → database
    if (frontendStatus === "down") derivedFailureReason = "frontend_down";
    else if (backendStatus === "down") derivedFailureReason = "backend_down";
    else derivedFailureReason = "database_down";
  } else if (components.includes("degraded")) {
    status = "degraded";
  } else if (components.every((c) => c === "up")) {
    status = "up";
  } else {
    // Some/all components are "unknown" but none are down or degraded.
    // Fail safe: insufficient data should not imply healthy.
    status = "degraded";
    derivedFailureReason = "insufficient_health_data";
  }

  return {
    status,
    frontendStatus,
    backendStatus,
    databaseStatus,
    failureReason: derivedFailureReason,
  };
};

module.exports = { classify };
