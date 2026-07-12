/**
 * Application-wide constants
 *
 * Single source of truth for domain enums and shared config values.
 * Models import from here so the same values are accessible both
 * through `Model.CONSTANT` and via direct import from this file —
 * useful in services/workers that shouldn't need to load a full model
 * just to reference an enum value.
 */

// ── Monitor ──────────────────────────────────────────────────────────────────

/** Allowed polling intervals in seconds. */
export const INTERVAL_PRESETS = Object.freeze([
  30, 60, 120, 300, 600, 900, 1800, 3600,
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

/** Incident severity levels. */
export const INCIDENT_SEVERITY = Object.freeze({
  CRITICAL: "critical",
  MAJOR: "major",
  MINOR: "minor",
});

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
