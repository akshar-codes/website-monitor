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
  TLS_ERROR: "tls_error",
  INVALID_CONFIGURATION: "invalid_configuration",
  REDIRECT_ERROR: "redirect_error",
  UNSUPPORTED_RESPONSE: "unsupported_response",
  ASSERTION_FAILURE: "assertion_failure",
  ASSERTION_ERROR: "assertion_error",
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

// ── SLO & Error Budget ───────────────────────────────────────────────────────

/** Supported SLO rolling windows and their durations in milliseconds. */
export const SLO_ROLLING_WINDOW_MS = Object.freeze({
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "14d": 14 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  "60d": 60 * 24 * 60 * 60 * 1000,
  "90d": 90 * 24 * 60 * 60 * 1000,
});

export const SLO_ROLLING_WINDOWS = Object.freeze(
  Object.keys(SLO_ROLLING_WINDOW_MS),
);

/** Supported SLO evaluation intervals. */
export const SLO_EVALUATION_INTERVALS = Object.freeze([
  "1m",
  "5m",
  "15m",
  "30m",
  "1h",
  "6h",
  "24h",
]);

/** Supported burn rate analysis windows and their durations in milliseconds. */
export const SLO_BURN_RATE_WINDOW_MS = Object.freeze({
  "5m": 5 * 60 * 1000,
  "15m": 15 * 60 * 1000,
  "30m": 30 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "2h": 2 * 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "12h": 12 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "3d": 3 * 24 * 60 * 60 * 1000,
});

export const SLO_BURN_RATE_WINDOWS = Object.freeze(
  Object.keys(SLO_BURN_RATE_WINDOW_MS),
);

/** Alert severities for SLO thresholds. */
export const SLO_SEVERITY = Object.freeze([
  "critical",
  "high",
  "normal",
  "low",
]);

/** Fields the SLO list endpoint may sort by. */
export const SLO_SORT_FIELDS = Object.freeze([
  "name",
  "targetPercentage",
  "createdAt",
  "updatedAt",
]);

// ── Job Monitor (Background Jobs / Cron) ────────────────────────────────────

export const JOB_SCHEDULE_TYPES = Object.freeze({
  INTERVAL: "interval",
  CRON: "cron",
});

export const JOB_SCHEDULE_TYPE_VALUES = Object.freeze(
  Object.values(JOB_SCHEDULE_TYPES),
);

export const JOB_STATUS = Object.freeze({
  UP: "up",
  DOWN: "down",
  LATE: "late",
  PAUSED: "paused",
  PENDING: "pending",
});

export const JOB_STATUS_VALUES = Object.freeze(Object.values(JOB_STATUS));

export const JOB_RUN_STATUS = Object.freeze({
  STARTED: "started",
  SUCCEEDED: "succeeded",
  FAILED: "failed",
  MISSED: "missed",
  TIMED_OUT: "timed_out",
});

export const JOB_RUN_STATUS_VALUES = Object.freeze(
  Object.values(JOB_RUN_STATUS),
);

export const JOB_SORT_FIELDS = Object.freeze([
  "name",
  "status",
  "lastPingAt",
  "nextExpectedAt",
  "createdAt",
  "updatedAt",
]);

export const JOB_MONITOR_LIMITS = Object.freeze({
  MIN_INTERVAL_SECONDS: 10,
  MAX_INTERVAL_SECONDS: 31536000, // 1 year
  MIN_GRACE_PERIOD_SECONDS: 10,
  MAX_GRACE_PERIOD_SECONDS: 86400, // 24 hours
  DEFAULT_GRACE_PERIOD_SECONDS: 300, // 5 minutes
  MIN_RUN_TIMEOUT_SECONDS: 10,
  MAX_RUN_TIMEOUT_SECONDS: 604800, // 7 days
  DEFAULT_RUN_TIMEOUT_SECONDS: 3600, // 1 hour
  MIN_FAILURE_THRESHOLD: 1,
  MAX_FAILURE_THRESHOLD: 10,
  DEFAULT_FAILURE_THRESHOLD: 1,
  MIN_RECOVERY_THRESHOLD: 1,
  MAX_RECOVERY_THRESHOLD: 10,
  DEFAULT_RECOVERY_THRESHOLD: 1,
});

// ── Service Dependency & Graph Mapping ──────────────────────────────────────

export const DEPENDENCY_TYPES = Object.freeze({
  HARD: "hard",
  SOFT: "soft",
});

export const DEPENDENCY_TYPE_VALUES = Object.freeze(
  Object.values(DEPENDENCY_TYPES),
);

export const DEPENDENCY_TARGET_TYPES = Object.freeze({
  MONITOR: "monitor",
  EXTERNAL_SERVICE: "external_service",
});

export const DEPENDENCY_TARGET_TYPE_VALUES = Object.freeze(
  Object.values(DEPENDENCY_TARGET_TYPES),
);

export const EXTERNAL_SERVICE_TYPES = Object.freeze({
  DATABASE: "database",
  THIRD_PARTY_API: "third_party_api",
  PAYMENT_PROVIDER: "payment_provider",
  CLOUD_SERVICE: "cloud_service",
  MESSAGE_BROKER: "message_broker",
  OTHER: "other",
});

export const EXTERNAL_SERVICE_TYPE_VALUES = Object.freeze(
  Object.values(EXTERNAL_SERVICE_TYPES),
);

export const DEPENDENCY_SORT_FIELDS = Object.freeze([
  "createdAt",
  "updatedAt",
  "dependencyType",
  "isActive",
]);

export const GRAPH_LIMITS = Object.freeze({
  MAX_DEPENDENCY_DEPTH: 10,
  MAX_GRAPH_NODES_PER_USER: 200,
  HEALTH_DATA_STALENESS_FACTOR: 2.5,
  MIN_STALENESS_SECONDS: 600, // 10 minutes
});
