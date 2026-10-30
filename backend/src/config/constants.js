// ── Monitor ──────────────────────────────────────────────────────────────────

/** Allowed polling intervals in seconds. */
export const INTERVAL_PRESETS = Object.freeze([
  30, 60, 120, 300, 600, 900, 1800, 3600,
]);

/** Fields the monitor list endpoint may sort by. */
export const MONITOR_SORT_FIELDS = Object.freeze([
  "name",
  "url",
  "interval",
  "createdAt",
  "updatedAt",
]);

// ── Health Check ─────────────────────────────────────────────────────────────

/** Overall and per-component health statuses. */
export const HEALTH_STATUS = Object.freeze({
  UP: "up",
  DOWN: "down",
  DEGRADED: "degraded",
  UNKNOWN: "unknown",
});

/** Reasons a health check can fail. */
export const FAILURE_REASONS = Object.freeze({
  TIMEOUT: "timeout",
  UNSAFE_DESTINATION: "unsafe_destination",
  RESPONSE_TOO_LARGE: "response_too_large",
  DNS_ERROR: "dns_error",
  CONNECTION_REFUSED: "connection_refused",
  INVALID_JSON: "invalid_json",
  INVALID_CONTRACT: "invalid_contract",
  INSUFFICIENT_HEALTH_DATA: "insufficient_health_data",
  HTTP_ERROR: "http_error",
  FRONTEND_DOWN: "frontend_down",
  BACKEND_DOWN: "backend_down",
  DATABASE_DOWN: "database_down",
  UNKNOWN: "unknown",
});

// ── Incident ─────────────────────────────────────────────────────────────────

/** Incident lifecycle statuses. */
export const INCIDENT_STATUS = Object.freeze({
  ONGOING: "ongoing",
  INVESTIGATING: "investigating",
  IDENTIFIED: "identified",
  RESOLVED: "resolved",
});

export const INCIDENT_STATUS_FILTER_ACTIVE = "active";

export const INCIDENT_STATUS_FILTER_ALL = "all";

/** Incident severity levels. */
export const INCIDENT_SEVERITY = Object.freeze({
  CRITICAL: "critical",
  MAJOR: "major",
  MINOR: "minor",
});

// ── Authentication / OAuth ───────────────────────────────────────────────────

export const OAUTH_PROVIDERS = Object.freeze({
  GOOGLE: "google",
  GITHUB: "github",
});

export const OAUTH_PROVIDER_VALUES = Object.freeze(
  Object.values(OAUTH_PROVIDERS),
);

// ── Authorization (roles) ────────────────────────────────────────────────────

export const ROLES = Object.freeze({
  USER: "user",
  ADMIN: "admin",
});

export const ROLE_VALUES = Object.freeze(Object.values(ROLES));

// ── Subscription Plans ───────────────────────────────────────────────────────

export const PLANS = Object.freeze({
  FREE: "free",
  PRO: "pro",
  UNLIMITED: "unlimited",
});

export const PLAN_VALUES = Object.freeze(Object.values(PLANS));

/** Lifecycle status of a user's current plan subscription. */
export const PLAN_STATUS = Object.freeze({
  ACTIVE: "active",
  CANCELED: "canceled",
  EXPIRED: "expired",
  SUSPENDED: "suspended",
});

export const PLAN_STATUS_VALUES = Object.freeze(Object.values(PLAN_STATUS));

// ── Plan Upgrade Requests ────────────────────────────────────────────────────

export const PLAN_UPGRADE_REQUEST_STATUS = Object.freeze({
  PENDING: "pending",
  PAYMENT_PENDING: "payment_pending",
  APPROVED: "approved",
  REJECTED: "rejected",
});

export const PLAN_UPGRADE_REQUEST_STATUS_VALUES = Object.freeze(
  Object.values(PLAN_UPGRADE_REQUEST_STATUS),
);

// ── Shared Mongoose populate projections ──────────────────────────────────────

/** Fields selected when populating a `monitor` reference. */
export const MONITOR_POPULATE_FIELDS = "name url";

/** Fields selected when populating a `triggerCheck` reference (list views). */
export const TRIGGER_CHECK_POPULATE_FIELDS =
  "status responseTime httpStatus failureReason checkedAt";

/** Extended fields for `triggerCheck`, used on single-incident detail views. */
export const TRIGGER_CHECK_DETAIL_POPULATE_FIELDS =
  "status responseTime httpStatus failureReason checkedAt frontendStatus backendStatus databaseStatus";

// ── Time windows ─────────────────────────────────────────────────────────────

/**
 * Named time windows in milliseconds.
 * Used by dashboard and incident services for date-range queries.
 */
export const WINDOW_MS = Object.freeze({
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
});

/** Ordered list of valid window keys for use in Zod schemas. */
export const WINDOW_KEYS = Object.freeze(Object.keys(WINDOW_MS));
