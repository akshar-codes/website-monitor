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

/**
 * Query-param sentinel meaning "any non-resolved status" — not a real
 * status value, used only for filtering the incident list endpoint.
 */
export const INCIDENT_STATUS_FILTER_ACTIVE = "active";

/** Incident severity levels. */
export const INCIDENT_SEVERITY = Object.freeze({
  CRITICAL: "critical",
  MAJOR: "major",
  MINOR: "minor",
});

// ── Authentication / OAuth ───────────────────────────────────────────────────

/**
 * Supported OAuth providers. Adding a new provider (Facebook, Microsoft,
 * Discord, ...) starts here — add the key, then a matching strategy file
 * under config/oauth/ and an entry in config/oauth/providers.config.js.
 *
 * This is the single source of truth for OAuth provider identifiers.
 * Referenced by models/User.js (oauthAccounts enum), config/oauth/*.strategy.js,
 * config/oauth/providers.config.js, and controllers/oauth.controller.js.
 */
export const OAUTH_PROVIDERS = Object.freeze({
  GOOGLE: "google",
  GITHUB: "github",
});

export const OAUTH_PROVIDER_VALUES = Object.freeze(
  Object.values(OAUTH_PROVIDERS),
);

// ── Authorization (roles) ────────────────────────────────────────────────────

/**
 * Application-level roles — govern what a user is PERMITTED to do
 * (authorization). Deliberately kept separate from any future
 * subscription/billing "plan" concept, which would govern what a user is
 * ENTITLED to (limits, feature gates). A role change must never silently
 * affect billing, and a plan change must never grant elevated permissions —
 * so these two concerns must never be merged into a single field.
 *
 * Single source of truth — referenced by models/User.js (schema enum +
 * default), middlewares/authorize.js callers, and validators/admin.validator.js.
 */
export const ROLES = Object.freeze({
  USER: "user",
  ADMIN: "admin",
});

export const ROLE_VALUES = Object.freeze(Object.values(ROLES));

// ── Subscription Plans ───────────────────────────────────────────────────────

/**
 * Subscription plan identifiers. Deliberately independent of ROLES above —
 * a plan governs entitlements (monitor limits, check-interval floor, data
 * retention), a role governs permissions. The two must never be merged.
 *
 * This is the single source of truth for plan identifiers. Full plan
 * metadata (pricing, limits, marketing feature copy) lives in
 * config/plans.js, mirroring how OAUTH_PROVIDERS (identifiers, here) is
 * split from config/oauth/providers.config.js (definitions).
 *
 * To add a new plan tier:
 *   1. Add its key here
 *   2. Add its definition to config/plans.js (assign the next `rank`)
 *   3. Nothing else needs to change — validation, upgrade/downgrade
 *      comparison, and the frontend catalog all read from that map.
 */
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
});

export const PLAN_STATUS_VALUES = Object.freeze(Object.values(PLAN_STATUS));

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
